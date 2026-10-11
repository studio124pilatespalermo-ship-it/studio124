import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { classSlots, templateSlots } from "../../db/schema.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import { agenda, cancelBooking, changeBooking, createBooking, markAttendance } from "../../services/bookings.ts";
import { generateMonth, previewMonth } from "../../services/schedule.ts";
import { readSettings } from "../../services/settings.ts";
import type { AppContext, Variables } from "../context.ts";
import { requireAdmin, requireStaff, staffOf } from "../auth.ts";
import { audit } from "../audit.ts";

const templateInput = z.object({
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.number().int().min(15).max(180),
  capacity: z.number().int().min(1).max(30),
  professionalId: z.uuid().nullable().optional(),
  active: z.boolean().default(true),
});

const monthQuery = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  skipHolidays: z.coerce.boolean().optional(),
});

export function scheduleRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", requireStaff);

  /** Agenda modelo: la semana tipo. */
  app.get("/template", async (c) => {
    const rows = await ctx.db
      .select()
      .from(templateSlots)
      .orderBy(asc(templateSlots.weekday), asc(templateSlots.startTime));
    return c.json({ template: rows });
  });

  app.post("/template", requireAdmin, async (c) => {
    const config = await readSettings(ctx.db);
    const input = templateInput.partial({ durationMin: true, capacity: true }).parse(await c.req.json());
    const [created] = await ctx.db
      .insert(templateSlots)
      .values({
        weekday: input.weekday,
        startTime: input.startTime,
        durationMin: input.durationMin ?? config["schedule.defaultDurationMin"],
        capacity: input.capacity ?? config["schedule.defaultCapacity"],
        professionalId: input.professionalId ?? null,
        active: input.active,
      })
      .returning();
    if (!created) throw new AppError("conflict", "No se pudo crear el turno de la agenda modelo.");
    await audit(ctx.db, staffOf(c), "template.create", "template_slot", created.id, input);
    return c.json({ slot: created }, 201);
  });

  app.patch("/template/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const input = templateInput.partial().parse(await c.req.json());
    const [updated] = await ctx.db.update(templateSlots).set(input).where(eq(templateSlots.id, id)).returning();
    if (!updated) throw notFound("Turno de la agenda modelo");
    await audit(ctx.db, staffOf(c), "template.update", "template_slot", id, input);
    return c.json({ slot: updated });
  });

  app.delete("/template/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const [updated] = await ctx.db.update(templateSlots).set({ active: false }).where(eq(templateSlots.id, id)).returning();
    if (!updated) throw notFound("Turno de la agenda modelo");
    await audit(ctx.db, staffOf(c), "template.deactivate", "template_slot", id, null);
    return c.json({ ok: true });
  });

  /** Vista previa de "Generar mes": no escribe nada. */
  app.get("/generate/preview", async (c) => {
    const input = monthQuery.parse(c.req.query());
    return c.json(await previewMonth(ctx.db, input));
  });

  /** Crea sólo los turnos que faltan; nunca pisa lo ya cargado. */
  app.post("/generate", requireAdmin, async (c) => {
    const input = monthQuery.parse(await c.req.json());
    const result = await generateMonth(ctx.db, input);
    await audit(ctx.db, staffOf(c), "schedule.generate", "class_slot", null, { ...input, created: result.created });
    return c.json(result);
  });

  app.get("/agenda", async (c) => {
    const input = z
      .object({ from: z.iso.date(), to: z.iso.date(), professionalId: z.uuid().optional() })
      .parse(c.req.query());
    return c.json({ slots: await agenda(ctx.db, input) });
  });

  app.patch("/slots/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const input = z
      .object({
        capacity: z.number().int().min(1).max(30).optional(),
        durationMin: z.number().int().min(15).max(180).optional(),
        professionalId: z.uuid().nullable().optional(),
        status: z.enum(["scheduled", "cancelled"]).optional(),
      })
      .parse(await c.req.json());
    const [updated] = await ctx.db.update(classSlots).set(input).where(eq(classSlots.id, id)).returning();
    if (!updated) throw notFound("Turno");
    await audit(ctx.db, staffOf(c), "slot.update", "class_slot", id, input);
    return c.json({ slot: updated });
  });

  /** Reserva cargada por el panel: la administradora puede saltear la ventana de tiempo. */
  app.post("/bookings", async (c) => {
    const input = z
      .object({
        clientId: z.uuid(),
        slotId: z.uuid(),
        packId: z.uuid().optional(),
        source: z.enum(["fixed", "admin"]).optional(),
      })
      .parse(await c.req.json());
    const created = await createBooking(ctx.db, {
      clientId: input.clientId,
      slotId: input.slotId,
      packId: input.packId,
      source: input.source ?? "admin",
      by: { kind: "staff", actor: staffOf(c) },
    });
    await audit(ctx.db, staffOf(c), "booking.create", "booking", created.id, input);
    return c.json({ booking: created }, 201);
  });

  app.post("/bookings/:id/cancel", async (c) => {
    const id = c.req.param("id");
    const input = z
      .object({ refundAnyway: z.boolean().optional(), note: z.string().max(300).optional() })
      .parse(await c.req.json().catch(() => ({})));
    const result = await cancelBooking(ctx.db, {
      bookingId: id,
      by: { kind: "staff", actor: staffOf(c) },
      refundAnyway: input.refundAnyway,
      note: input.note,
    });
    await audit(ctx.db, staffOf(c), "booking.cancel", "booking", id, { ...input, ...result });
    return c.json(result);
  });

  app.post("/bookings/:id/change", async (c) => {
    const id = c.req.param("id");
    const { toSlotId } = z.object({ toSlotId: z.uuid() }).parse(await c.req.json());
    const created = await changeBooking(ctx.db, { bookingId: id, toSlotId, by: { kind: "staff", actor: staffOf(c) } });
    await audit(ctx.db, staffOf(c), "booking.change", "booking", id, { toSlotId, newBookingId: created.id });
    return c.json({ booking: created });
  });

  /** Asistencia: la instructora puede marcarla si la configuración lo permite. */
  app.post("/bookings/:id/attendance", async (c) => {
    const staff = c.get("staff");
    const config = await readSettings(ctx.db);
    if (staff && staff.role !== "admin" && !config["staff.canMarkAttendance"]) {
      throw new AppError("forbidden", "La toma de asistencia está restringida a administración.");
    }
    const id = c.req.param("id");
    const { status } = z.object({ status: z.enum(["attended", "absent", "booked"]) }).parse(await c.req.json());
    const result = await markAttendance(ctx.db, { bookingId: id, status });
    await audit(ctx.db, staffOf(c), "booking.attendance", "booking", id, result);
    return c.json(result);
  });

  return app;
}
