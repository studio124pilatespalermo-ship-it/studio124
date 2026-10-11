import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { holidays, paymentCategories, paymentMethods, professionals } from "../../db/schema.ts";
import { AppError, notFound } from "../../lib/errors.ts";
import type { AppContext, Variables } from "../context.ts";
import { requireAdmin, requireStaff, staffOf } from "../auth.ts";
import { audit } from "../audit.ts";

/** Catálogo editable desde el panel: categorías, medios de pago, profesionales y feriados. */

const categoryInput = z.object({
  name: z.string().min(2).max(80),
  kind: z.enum(["trial", "single", "single_duo", "pack", "monthly"]),
  classes: z.number().int().min(1).max(60),
  validityDays: z.number().int().min(1).max(400),
  priceMinor: z.number().int().min(0),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  sellOnline: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export function catalogRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", requireStaff);

  app.get("/", async (c) => {
    const [categories, methods, people, days] = await Promise.all([
      ctx.db.select().from(paymentCategories).orderBy(asc(paymentCategories.sortOrder), asc(paymentCategories.name)),
      ctx.db.select().from(paymentMethods).orderBy(asc(paymentMethods.name)),
      ctx.db.select().from(professionals).orderBy(asc(professionals.name)),
      ctx.db.select().from(holidays).orderBy(asc(holidays.date)),
    ]);
    return c.json({
      categories,
      methods,
      professionals: people.filter((person) => person.deletedAt === null),
      holidays: days,
    });
  });

  app.post("/categories", requireAdmin, async (c) => {
    const input = categoryInput.parse(await c.req.json());
    const [created] = await ctx.db.insert(paymentCategories).values(input).returning();
    if (!created) throw new AppError("conflict", "No se pudo crear la categoría.");
    await audit(ctx.db, staffOf(c), "category.create", "payment_category", created.id, input);
    return c.json({ category: created }, 201);
  });

  app.patch("/categories/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const input = categoryInput.partial().parse(await c.req.json());
    const [updated] = await ctx.db.update(paymentCategories).set(input).where(eq(paymentCategories.id, id)).returning();
    if (!updated) throw notFound("Categoría");
    await audit(ctx.db, staffOf(c), "category.update", "payment_category", id, input);
    return c.json({ category: updated });
  });

  app.post("/professionals", requireAdmin, async (c) => {
    const input = z.object({ name: z.string().min(2).max(80) }).parse(await c.req.json());
    const [created] = await ctx.db.insert(professionals).values({ name: input.name.trim() }).returning();
    if (!created) throw new AppError("conflict", "No se pudo crear el profesional.");
    await audit(ctx.db, staffOf(c), "professional.create", "professional", created.id, input);
    return c.json({ professional: created }, 201);
  });

  app.patch("/professionals/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const input = z
      .object({ name: z.string().min(2).max(80).optional(), active: z.boolean().optional() })
      .parse(await c.req.json());
    const [updated] = await ctx.db.update(professionals).set(input).where(eq(professionals.id, id)).returning();
    if (!updated) throw notFound("Profesional");
    await audit(ctx.db, staffOf(c), "professional.update", "professional", id, input);
    return c.json({ professional: updated });
  });

  /** Baja lógica: los turnos pasados conservan a quién los dio. */
  app.delete("/professionals/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const [updated] = await ctx.db
      .update(professionals)
      .set({ active: false, deletedAt: new Date() })
      .where(eq(professionals.id, id))
      .returning();
    if (!updated) throw notFound("Profesional");
    await audit(ctx.db, staffOf(c), "professional.delete", "professional", id, null);
    return c.json({ ok: true });
  });

  app.patch("/methods/:id", requireAdmin, async (c) => {
    const id = c.req.param("id");
    const input = z
      .object({ name: z.string().min(2).max(60).optional(), active: z.boolean().optional() })
      .parse(await c.req.json());
    const [updated] = await ctx.db.update(paymentMethods).set(input).where(eq(paymentMethods.id, id)).returning();
    if (!updated) throw notFound("Medio de pago");
    await audit(ctx.db, staffOf(c), "method.update", "payment_method", id, input);
    return c.json({ method: updated });
  });

  app.post("/holidays", async (c) => {
    const input = z.object({ date: z.iso.date(), name: z.string().min(2).max(80) }).parse(await c.req.json());
    const [created] = await ctx.db
      .insert(holidays)
      .values(input)
      .onConflictDoUpdate({ target: holidays.date, set: { name: input.name } })
      .returning();
    await audit(ctx.db, staffOf(c), "holiday.create", "holiday", created?.id ?? null, input);
    return c.json({ holiday: created }, 201);
  });

  app.delete("/holidays/:id", async (c) => {
    const id = c.req.param("id");
    await ctx.db.delete(holidays).where(eq(holidays.id, id));
    await audit(ctx.db, staffOf(c), "holiday.delete", "holiday", id, null);
    return c.json({ ok: true });
  });

  return app;
}
