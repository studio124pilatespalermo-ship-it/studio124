import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { paymentCategories } from "../../db/schema.ts";
import type { AppContext, Variables } from "../context.ts";

/**
 * Datos públicos para la landing: no piden sesión y se pueden cachear. Sólo exponen lo que
 * el estudio marcó para mostrar; nada de clientes, pagos ni configuración.
 */
export function publicRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();

  /** Precios que el estudio marcó "Mostrar en la landing" en el Catálogo del panel. */
  app.get("/prices", async (c) => {
    const prices = await ctx.db
      .select({
        id: paymentCategories.id,
        kind: paymentCategories.kind,
        classes: paymentCategories.classes,
        validityDays: paymentCategories.validityDays,
        priceMinor: paymentCategories.priceMinor,
        currency: paymentCategories.currency,
      })
      .from(paymentCategories)
      .where(and(eq(paymentCategories.active, true), eq(paymentCategories.showOnLanding, true)))
      .orderBy(asc(paymentCategories.sortOrder), asc(paymentCategories.classes));
    // Cinco minutos de caché: un cambio de precio en el panel se ve en la landing enseguida.
    c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return c.json({ prices });
  });

  return app;
}
