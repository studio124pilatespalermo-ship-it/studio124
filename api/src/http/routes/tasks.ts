import { Hono } from "hono";
import { safeEqual } from "../../lib/crypto.ts";
import { AppError } from "../../lib/errors.ts";
import { expirePacks } from "../../services/credits.ts";
import { sendExpiryNotices } from "../../services/notifications.ts";
import type { AppContext, Variables } from "../context.ts";
import { purgeExpiredSessions } from "../auth.ts";
import { audit } from "../audit.ts";

/**
 * Tareas diarias, disparadas por un cron externo (Vercel Cron o el scheduler de Railway)
 * con la cabecera `Authorization: Bearer <CRON_SECRET>`. Es idempotente: correrla dos
 * veces el mismo día no duplica avisos.
 */
export function tasksRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();

  app.post("/daily", async (c) => {
    const expected = ctx.env.CRON_SECRET;
    if (!expected) throw new AppError("not_configured", "Falta CRON_SECRET para habilitar las tareas programadas.");
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!safeEqual(token, expected)) throw new AppError("unauthorized", "Token de tarea inválido.");

    const expired = await expirePacks(ctx.db);
    const notices = await sendExpiryNotices(ctx.db, ctx.secrets);
    await purgeExpiredSessions(ctx.db);

    await audit(ctx.db, null, "task.daily", "task", null, { expired: expired.length, notices: notices.sent });
    return c.json({ expired: expired.length, notices });
  });

  return app;
}
