import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { users } from "../../db/schema.ts";
import { AppError } from "../../lib/errors.ts";
import { verifyPassword } from "../../lib/password.ts";
import type { AppContext, Variables } from "../context.ts";
import { destroySession, issueSession, requireStaff } from "../auth.ts";

const credentials = z.object({ email: z.email(), password: z.string().min(1) });

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

  return app;
}
