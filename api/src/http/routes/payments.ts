import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { clients, packs } from "../../db/schema.ts";
import { todayInStudio } from "../../lib/dates.ts";
import { packBalance } from "../../services/credits.ts";
import { confirmPayment, verifySignature } from "../../services/mercadopago.ts";
import { listPacks, registerPayment, suggestSlots } from "../../services/packs.ts";
import { createBooking } from "../../services/bookings.ts";
import type { AppContext, Variables } from "../context.ts";
import { requireStaff, staffOf } from "../auth.ts";
import { audit } from "../audit.ts";

export function paymentRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();

  /**
   * Webhook de Mercado Pago. Va ANTES del middleware de sesión porque lo llama
   * Mercado Pago, no un usuario. Siempre responde 200: un error nuestro no debe
   * hacer que Mercado Pago reintente en bucle.
   */
  app.post("/webhook", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
    const topic = body.type ?? c.req.query("topic") ?? c.req.query("type");
    const dataId = body.data?.id ?? c.req.query("id") ?? c.req.query("data.id");
    if (topic !== "payment" || !dataId) return c.json({ received: true });

    const secret = await ctx.secrets.get("MP_WEBHOOK_SECRET");
    if (!secret) {
      console.error("[mp] Aviso recibido sin MP_WEBHOOK_SECRET cargado: se ignora.");
      return c.json({ received: true });
    }

    const check = verifySignature({
      signature: c.req.header("x-signature"),
      requestId: c.req.header("x-request-id"),
      dataId: String(dataId),
      secret,
    });
    if (!check.valid) {
      // Aceptar un aviso sin verificar permitiría marcar pagos como aprobados.
      console.error(`[mp] Firma rechazada (${check.reason}).`);
      return c.json({ received: true });
    }

    try {
      const result = await confirmPayment(ctx.db, ctx.secrets, String(dataId));
      if (result.status === "applied") {
        await audit(ctx.db, null, "payment.confirmed", "pack", result.packId ?? null, { mpPaymentId: dataId });
      }
    } catch (error) {
      console.error("[mp] No se pudo confirmar el pago:", error);
    }
    return c.json({ received: true });
  });

  app.use("*", requireStaff);

  app.get("/", async (c) => {
    const status = c.req.query("status");
    return c.json({ packs: await listPacks(ctx.db, status === "expired" ? { status: "expired" } : {}) });
  });

  /** Abonos vencidos y clientes con saldo sin usar. */
  app.get("/expired", async (c) => {
    const today = todayInStudio();
    const rows = await ctx.db
      .select({
        packId: packs.id,
        clientId: packs.clientId,
        clientName: clients.name,
        email: clients.email,
        endsOn: packs.endsOn,
        status: packs.status,
        classesTotal: packs.classesTotal,
      })
      .from(packs)
      .innerJoin(clients, eq(clients.id, packs.clientId))
      .where(sql`${packs.endsOn} < ${today}`)
      .orderBy(desc(packs.endsOn))
      .limit(200);
    return c.json({ packs: rows });
  });

  /** Abonos por vencer en los próximos días. */
  app.get("/expiring", async (c) => {
    const days = Number(c.req.query("days") ?? 7);
    const today = todayInStudio();
    const rows = await ctx.db
      .select({
        packId: packs.id,
        clientName: clients.name,
        email: clients.email,
        endsOn: packs.endsOn,
      })
      .from(packs)
      .innerJoin(clients, eq(clients.id, packs.clientId))
      .where(
        and(
          eq(packs.status, "active"),
          sql`${packs.endsOn} >= ${today}`,
          sql`${packs.endsOn} <= ${today}::date + ${days}::int`,
        ),
      )
      .orderBy(packs.endsOn);
    return c.json({ packs: rows });
  });

  app.post("/", async (c) => {
    const input = z
      .object({
        clientId: z.uuid(),
        categoryId: z.uuid(),
        methodId: z.uuid(),
        startsOn: z.iso.date(),
        endsOn: z.iso.date().optional(),
        amountMinor: z.number().int().min(0).optional(),
        classes: z.number().int().min(1).max(60).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(await c.req.json());
    const created = await registerPayment(ctx.db, { ...input, actor: staffOf(c) });
    await audit(ctx.db, staffOf(c), "payment.register", "pack", created.id, input);
    return c.json({ pack: created, balance: await packBalance(ctx.db, created.id) }, 201);
  });

  /** Vista previa de "Cargar turnos": propone, no crea. */
  app.get("/:packId/suggested-slots", async (c) => {
    return c.json({ slots: await suggestSlots(ctx.db, c.req.param("packId")) });
  });

  /** Confirmación de la carga: crea sólo los turnos que la administradora aprobó. */
  app.post("/:packId/load-slots", async (c) => {
    const packId = c.req.param("packId");
    const { slotIds } = z.object({ slotIds: z.array(z.uuid()).min(1).max(60) }).parse(await c.req.json());
    const balance = await packBalance(ctx.db, packId);
    if (!balance) throw new Error("Abono no encontrado.");

    const created: string[] = [];
    const failed: { slotId: string; message: string }[] = [];
    for (const slotId of slotIds) {
      try {
        const booking = await createBooking(ctx.db, {
          clientId: balance.clientId,
          slotId,
          packId,
          source: "fixed",
          by: { kind: "staff", actor: staffOf(c) },
        });
        created.push(booking.id);
      } catch (error) {
        failed.push({ slotId, message: error instanceof Error ? error.message : "Error" });
      }
    }
    await audit(ctx.db, staffOf(c), "pack.loadSlots", "pack", packId, { created: created.length, failed: failed.length });
    return c.json({ created, failed, balance: await packBalance(ctx.db, packId) });
  });

  return app;
}
