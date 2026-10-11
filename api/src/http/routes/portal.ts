import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { bookings, classSlots, clients, paymentCategories } from "../../db/schema.ts";
import { addDays, todayInStudio } from "../../lib/dates.ts";
import { AppError } from "../../lib/errors.ts";
import { cancelBooking, changeBooking, createBooking } from "../../services/bookings.ts";
import { clientBalances } from "../../services/credits.ts";
import { createPreference } from "../../services/mercadopago.ts";
import { readSettings } from "../../services/settings.ts";
import type { AppContext, Variables } from "../context.ts";
import { clientIdOf, requireClient } from "../auth.ts";

/** Portal del cliente: sus turnos, los disponibles y el pago online. */
export function portalRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();

  /** Qué secciones mostrar; lo configura el panel. */
  app.get("/config", async (c) => {
    const config = await readSettings(ctx.db);
    return c.json({
      allowBooking: config["portal.allowBooking"],
      allowSelfSignup: config["portal.allowSelfSignup"],
      showAvailableSlots: config["portal.showAvailableSlots"],
      showPayments: config["portal.showPayments"],
      allowOnlinePayment: config["portal.allowOnlinePayment"],
      changeWindowHours: config["booking.changeWindowHours"],
      cancelWindowHours: config["booking.cancelWindowHours"],
      timezoneNote: config["studio.timezoneNote"],
    });
  });

  app.use("*", requireClient);

  app.get("/me", async (c) => {
    const clientId = clientIdOf(c);
    const [client] = await ctx.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    const balances = await clientBalances(ctx.db, clientId);
    return c.json({
      client: client ? { id: client.id, name: client.name, email: client.email, locale: client.locale } : null,
      balances: balances.filter((balance) => balance.status === "active"),
    });
  });

  /** Idioma del cliente. Define el portal y, más adelante, el idioma de sus emails. */
  app.patch("/me", async (c) => {
    const { locale } = z.object({ locale: z.enum(["es", "en", "pt"]) }).parse(await c.req.json());
    await ctx.db.update(clients).set({ locale, updatedAt: new Date() }).where(eq(clients.id, clientIdOf(c)));
    return c.json({ locale });
  });

  /** Mis turnos, de hoy en adelante. */
  app.get("/bookings", async (c) => {
    const clientId = clientIdOf(c);
    const rows = await ctx.db
      .select({
        id: bookings.id,
        status: bookings.status,
        date: classSlots.date,
        startTime: classSlots.startTime,
        durationMin: classSlots.durationMin,
      })
      .from(bookings)
      .innerJoin(classSlots, eq(classSlots.id, bookings.classSlotId))
      .where(and(eq(bookings.clientId, clientId), sql`${classSlots.date} >= ${todayInStudio()}`))
      .orderBy(classSlots.date, classSlots.startTime);
    return c.json({ bookings: rows });
  });

  /** Turnos con lugar libre dentro del horizonte configurado. */
  app.get("/available", async (c) => {
    const config = await readSettings(ctx.db);
    if (!config["portal.showAvailableSlots"]) throw new AppError("forbidden", "Sección no disponible.");

    const today = todayInStudio();
    const slots = await ctx.db
      .select()
      .from(classSlots)
      .where(
        and(
          eq(classSlots.status, "scheduled"),
          sql`${classSlots.date} >= ${today}`,
          sql`${classSlots.date} <= ${addDays(today, config["booking.horizonDays"])}`,
        ),
      )
      .orderBy(classSlots.date, classSlots.startTime);
    if (slots.length === 0) return c.json({ slots: [] });

    const taken = await ctx.db
      .select({ slotId: bookings.classSlotId, status: bookings.status })
      .from(bookings)
      .where(
        inArray(
          bookings.classSlotId,
          slots.map((slot) => slot.id),
        ),
      );

    const available = slots
      .map((slot) => {
        const used = taken.filter((row) => row.slotId === slot.id && !row.status.startsWith("cancelled")).length;
        return { id: slot.id, date: slot.date, startTime: slot.startTime, durationMin: slot.durationMin, free: slot.capacity - used };
      })
      .filter((slot) => slot.free > 0);
    return c.json({ slots: available });
  });

  app.post("/bookings", async (c) => {
    const { slotId } = z.object({ slotId: z.uuid() }).parse(await c.req.json());
    const created = await createBooking(ctx.db, {
      clientId: clientIdOf(c),
      slotId,
      by: { kind: "client", clientId: clientIdOf(c) },
    });
    return c.json({ booking: created }, 201);
  });

  app.post("/bookings/:id/cancel", async (c) => {
    const result = await cancelBooking(ctx.db, {
      bookingId: c.req.param("id"),
      by: { kind: "client", clientId: clientIdOf(c) },
    });
    return c.json(result);
  });

  app.post("/bookings/:id/change", async (c) => {
    const { toSlotId } = z.object({ toSlotId: z.uuid() }).parse(await c.req.json());
    const created = await changeBooking(ctx.db, {
      bookingId: c.req.param("id"),
      toSlotId,
      by: { kind: "client", clientId: clientIdOf(c) },
    });
    return c.json({ booking: created });
  });

  /** Paquetes que el estudio habilitó para comprar online. */
  app.get("/categories", async (c) => {
    const config = await readSettings(ctx.db);
    if (!config["portal.showPayments"]) throw new AppError("forbidden", "Sección no disponible.");
    const rows = await ctx.db
      .select({
        id: paymentCategories.id,
        name: paymentCategories.name,
        classes: paymentCategories.classes,
        validityDays: paymentCategories.validityDays,
        priceMinor: paymentCategories.priceMinor,
        currency: paymentCategories.currency,
      })
      .from(paymentCategories)
      .where(and(eq(paymentCategories.active, true), eq(paymentCategories.sellOnline, true)))
      .orderBy(asc(paymentCategories.sortOrder));
    return c.json({ categories: rows });
  });

  /** Inicia el pago: devuelve el link al checkout de Mercado Pago. */
  app.post("/checkout", async (c) => {
    const config = await readSettings(ctx.db);
    if (!config["portal.allowOnlinePayment"]) throw new AppError("forbidden", "El pago online está desactivado.");
    const { categoryId } = z.object({ categoryId: z.uuid() }).parse(await c.req.json());
    const preference = await createPreference(ctx.db, ctx.secrets, {
      clientId: clientIdOf(c),
      categoryId,
      siteUrl: ctx.env.PUBLIC_SITE_URL,
      apiUrl: ctx.env.PUBLIC_API_URL,
    });
    return c.json({ initPoint: preference.initPoint, reference: preference.externalReference });
  });

  return app;
}
