import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.ts";
import type { AppContext, Variables } from "./context.ts";
import { withPrincipal } from "./auth.ts";
import { authRoutes } from "./routes/auth.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { clientRoutes } from "./routes/clients.ts";
import { paymentRoutes } from "./routes/payments.ts";
import { portalRoutes } from "./routes/portal.ts";
import { scheduleRoutes } from "./routes/schedule.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { tasksRoutes } from "./routes/tasks.ts";

export type HonoEnv = { Variables: Variables };

/** Formato de error estable para todas las rutas: { error, message, fieldErrors? }. */
function errorBody(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: err.code, message: err.message, ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}) },
    };
  }
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: 400, body: { error: "bad_request", message: "Datos inválidos.", fieldErrors } };
  }
  return { status: 500, body: { error: "internal_error", message: "Error interno." } };
}

export function createApp(ctx: AppContext): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  app.use("*", secureHeaders());
  app.use(
    "/api/*",
    cors({
      origin: [ctx.env.PUBLIC_SITE_URL, ...(ctx.env.NODE_ENV === "development" ? ["http://localhost:4321"] : [])],
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use("/api/*", withPrincipal(ctx));

  app.onError((err, c) => {
    const { status, body } = errorBody(err);
    if (status >= 500) console.error("[api]", err);
    return c.json(body, status as 400);
  });

  app.notFound((c) => c.json({ error: "not_found", message: "Ruta no encontrada." }, 404));

  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/api/health", async (c) => {
    const secrets = await ctx.secrets.list();
    return c.json({
      ok: true,
      env: ctx.env.NODE_ENV,
      integrations: Object.fromEntries(secrets.map((item) => [item.key, item.configured])),
    });
  });

  app.route("/api/auth", authRoutes(ctx));
  app.route("/api/clients", clientRoutes(ctx));
  app.route("/api/catalog", catalogRoutes(ctx));
  app.route("/api/schedule", scheduleRoutes(ctx));
  app.route("/api/payments", paymentRoutes(ctx));
  app.route("/api/settings", settingsRoutes(ctx));
  app.route("/api/portal", portalRoutes(ctx));
  app.route("/api/tasks", tasksRoutes(ctx));

  return app;
}
