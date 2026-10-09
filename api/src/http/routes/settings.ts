import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../../lib/errors.ts";
import { isSecretKey, SECRET_KEYS } from "../../services/secrets.ts";
import { readSettings, settingsPatchSchema, writeSettings } from "../../services/settings.ts";
import type { AppContext, Variables } from "../context.ts";
import { requireAdmin, requireStaff, staffOf } from "../auth.ts";
import { audit } from "../audit.ts";

export function settingsRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", requireStaff);

  app.get("/", async (c) => c.json({ settings: await readSettings(ctx.db) }));

  app.patch("/", requireAdmin, async (c) => {
    const patch = settingsPatchSchema.parse(await c.req.json());
    const updated = await writeSettings(ctx.db, patch);
    await audit(ctx.db, staffOf(c), "settings.update", "settings", null, patch);
    return c.json({ settings: updated });
  });

  /**
   * Credenciales de integraciones. La API nunca devuelve el valor guardado: sólo si está
   * cargada, su pista ("••••1234") y cuándo se actualizó.
   */
  app.get("/secrets", requireAdmin, async (c) => c.json({ secrets: await ctx.secrets.list() }));

  app.put("/secrets/:key", requireAdmin, async (c) => {
    const key = c.req.param("key");
    if (!isSecretKey(key)) throw new AppError("bad_request", `Credencial desconocida: ${key}.`);
    const { value } = z.object({ value: z.string().min(1).max(500) }).parse(await c.req.json());
    await ctx.secrets.set(key, value, staffOf(c).id);
    // Se audita la clave, nunca el valor.
    await audit(ctx.db, staffOf(c), "secret.update", "secret", key, { label: SECRET_KEYS[key] });
    return c.json({ secrets: await ctx.secrets.list() });
  });

  app.delete("/secrets/:key", requireAdmin, async (c) => {
    const key = c.req.param("key");
    if (!isSecretKey(key)) throw new AppError("bad_request", `Credencial desconocida: ${key}.`);
    await ctx.secrets.remove(key);
    await audit(ctx.db, staffOf(c), "secret.delete", "secret", key, null);
    return c.json({ secrets: await ctx.secrets.list() });
  });

  return app;
}
