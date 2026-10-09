import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { clients, fixedAssignments } from "../../db/schema.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { adjustCredits, clientBalances, listMovements } from "../../services/credits.ts";
import { clientFixedSlots, listPacks } from "../../services/packs.ts";
import type { AppContext, Variables } from "../context.ts";
import { requireStaff, staffOf } from "../auth.ts";
import { audit } from "../audit.ts";

const clientInput = z.object({
  name: z.string().min(2).max(120),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

const normalize = (value: string | undefined) => (value && value.trim() !== "" ? value.trim() : null);

export function clientRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", requireStaff);

  app.get("/", async (c) => {
    const status = c.req.query("status");
    const search = c.req.query("q")?.trim();
    const conditions = [];
    if (status === "active" || status === "inactive") conditions.push(eq(clients.status, status));
    if (search) {
      conditions.push(or(ilike(clients.name, `%${search}%`), ilike(clients.email, `%${search}%`)));
    }
    const rows = await ctx.db
      .select()
      .from(clients)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(clients.name);
    return c.json({ clients: rows });
  });

  /** Altas por mes, para el tablero. */
  app.get("/stats", async (c) => {
    const [active] = await ctx.db.select({ value: count() }).from(clients).where(eq(clients.status, "active"));
    const [inactive] = await ctx.db.select({ value: count() }).from(clients).where(eq(clients.status, "inactive"));
    const newByMonth = await ctx.db
      .select({ month: sql<string>`to_char(${clients.createdAt}, 'YYYY-MM')`, value: count() })
      .from(clients)
      .groupBy(sql`to_char(${clients.createdAt}, 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(${clients.createdAt}, 'YYYY-MM')`))
      .limit(12);
    return c.json({ active: active?.value ?? 0, inactive: inactive?.value ?? 0, newByMonth });
  });

  /** Listado de mails para comunicaciones; sólo clientes activos con email. */
  app.get("/emails", async (c) => {
    const rows = await ctx.db
      .select({ name: clients.name, email: clients.email })
      .from(clients)
      .where(and(eq(clients.status, "active"), sql`${clients.email} is not null`))
      .orderBy(clients.name);
    return c.json({ emails: rows });
  });

  app.post("/", async (c) => {
    const input = clientInput.parse(await c.req.json());
    const [created] = await ctx.db
      .insert(clients)
      .values({
        name: input.name.trim(),
        email: normalize(input.email),
        phone: normalize(input.phone),
        notes: normalize(input.notes),
      })
      .returning();
    if (!created) throw new AppError("conflict", "No se pudo crear el cliente.");
    await audit(ctx.db, staffOf(c), "client.create", "client", created.id, { name: created.name });
    return c.json({ client: created }, 201);
  });

  app.get("/:id", async (c) => {
    const id = c.req.param("id");
    const [client] = await ctx.db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!client) throw notFound("Cliente");
    const [balances, packs, fixed] = await Promise.all([
      clientBalances(ctx.db, id),
      listPacks(ctx.db, { clientId: id }),
      clientFixedSlots(ctx.db, id),
    ]);
    const movements = await listMovements(
      ctx.db,
      balances.map((balance) => balance.packId),
    );
    return c.json({ client, balances, packs, fixedSlots: fixed, movements });
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const input = clientInput.partial().extend({ status: z.enum(["active", "inactive"]).optional() }).parse(await c.req.json());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch["name"] = input.name.trim();
    if (input.email !== undefined) patch["email"] = normalize(input.email);
    if (input.phone !== undefined) patch["phone"] = normalize(input.phone);
    if (input.notes !== undefined) patch["notes"] = normalize(input.notes);
    if (input.status !== undefined) {
      patch["status"] = input.status;
      patch["deactivatedAt"] = input.status === "inactive" ? new Date() : null;
    }
    const [updated] = await ctx.db.update(clients).set(patch).where(eq(clients.id, id)).returning();
    if (!updated) throw notFound("Cliente");
    await audit(ctx.db, staffOf(c), "client.update", "client", id, input);
    return c.json({ client: updated });
  });

  /** Baja lógica: el historial del cliente se conserva. */
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const [updated] = await ctx.db
      .update(clients)
      .set({ status: "inactive", deactivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    if (!updated) throw notFound("Cliente");
    await audit(ctx.db, staffOf(c), "client.deactivate", "client", id, null);
    return c.json({ client: updated });
  });

  /** Turnos fijos del cliente sobre la agenda modelo. */
  app.put("/:id/fixed-slots", async (c) => {
    const id = c.req.param("id");
    const { templateSlotIds } = z.object({ templateSlotIds: z.array(z.uuid()) }).parse(await c.req.json());
    await ctx.db.delete(fixedAssignments).where(eq(fixedAssignments.clientId, id));
    if (templateSlotIds.length > 0) {
      await ctx.db
        .insert(fixedAssignments)
        .values(templateSlotIds.map((templateSlotId) => ({ clientId: id, templateSlotId })))
        .onConflictDoNothing();
    }
    await audit(ctx.db, staffOf(c), "client.fixedSlots", "client", id, { templateSlotIds });
    return c.json({ fixedSlots: await clientFixedSlots(ctx.db, id) });
  });

  /** Ajuste manual de créditos, siempre con motivo. */
  app.post("/:id/packs/:packId/adjust", async (c) => {
    const input = z.object({ delta: z.number().int(), note: z.string().min(3) }).parse(await c.req.json());
    const balance = await adjustCredits(ctx.db, {
      packId: c.req.param("packId"),
      delta: input.delta,
      note: input.note,
      actor: staffOf(c),
    });
    await audit(ctx.db, staffOf(c), "pack.adjust", "pack", c.req.param("packId"), input);
    return c.json({ balance });
  });

  return app;
}
