import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { users } from "../../db/schema.ts";
import { randomToken, safeEqual } from "../../lib/crypto.ts";
import { AppError } from "../../lib/errors.ts";
import { verifyPassword } from "../../lib/password.ts";
import { authorizeUrl, exchangeCode, findOrCreateClient, googleConfig } from "../../services/google-auth.ts";
import { readSettings } from "../../services/settings.ts";
import type { AppContext, Variables } from "../context.ts";
import { destroySession, issueSession, requireStaff } from "../auth.ts";
import { audit } from "../audit.ts";

const credentials = z.object({ email: z.email(), password: z.string().min(1) });

/** Cookie corta que guarda el `state` de OAuth hasta que Google nos devuelve el control. */
const STATE_COOKIE = "s124_oauth_state";

export function authRoutes(ctx: AppContext) {
  const app = new Hono<{ Variables: Variables }>();

  app.post("/panel/login", async (c) => {
    const { email, password } = credentials.parse(await c.req.json());
    const [user] = await ctx.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    // Mismo mensaje y mismo costo en los dos casos: no se revela si el email existe.
    const ok = user ? await verifyPassword(user.passwordHash, password) : false;
    if (!user || !ok || !user.active) throw new AppError("unauthorized", "Email o contraseña incorrectos.");

    await issueSession(ctx, c, { type: "user", id: user.id });
    return c.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  app.post("/panel/logout", async (c) => {
    await destroySession(ctx, c, "user");
    return c.json({ ok: true });
  });

  app.get("/me", (c) => {
    const principal = c.get("principal");
    return principal ? c.json({ principal }) : c.json({ principal: null });
  });

  app.get("/panel/me", requireStaff, (c) => c.json({ user: c.get("principal") }));

  /** Si Google no está configurado, el portal no ofrece el botón. */
  app.get("/google/status", (c) => c.json({ available: googleConfig(ctx.env) !== null }));

  app.get("/google/start", (c) => {
    const config = googleConfig(ctx.env);
    if (!config) throw new AppError("not_configured", "El ingreso con Google todavía no está configurado.");

    const state = randomToken(16);
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: ctx.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 600,
    });
    return c.redirect(authorizeUrl(config, state));
  });

  /**
   * Vuelta de Google. Siempre termina redirigiendo al portal: los errores viajan como
   * `?error=` para mostrarlos en la interfaz, no como una página de error de la API.
   */
  app.get("/google/callback", async (c) => {
    const portal = `${ctx.env.PUBLIC_SITE_URL}/cuenta/`;
    const fail = (reason: string) => c.redirect(`${portal}?error=${reason}`);

    const config = googleConfig(ctx.env);
    if (!config) return fail("not_configured");

    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    const state = c.req.query("state");
    // Sin este control, cualquiera podría iniciar el flujo en el navegador de otra persona.
    if (!expected || !state || !safeEqual(expected, state)) return fail("state");

    const code = c.req.query("code");
    if (!code) return fail("cancelled");

    try {
      const profile = await exchangeCode(config, code);
      const settings = await readSettings(ctx.db);
      const client = await findOrCreateClient(ctx.db, profile, settings["portal.allowSelfSignup"]);
      if (!client) return fail("no_account");

      await issueSession(ctx, c, { type: "client", id: client.id });
      await audit(ctx.db, { type: "client", id: client.id }, "client.login", "client", client.id, { via: "google" });
      return c.redirect(portal);
    } catch (error) {
      console.error("[auth] Falló el ingreso con Google:", error);
      return fail("google");
    }
  });

  app.post("/client/logout", async (c) => {
    await destroySession(ctx, c, "client");
    return c.json({ ok: true });
  });

  return app;
}
