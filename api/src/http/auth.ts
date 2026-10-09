import { and, eq, gt, lt } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { Database } from "../db/client.ts";
import { clients, sessions, users } from "../db/schema.ts";
import { randomToken, sha256 } from "../lib/crypto.ts";
import { AppError } from "../lib/errors.ts";
import type { AppContext, Principal, Variables } from "./context.ts";

/**
 * Sesiones en cookie HttpOnly. En la base se guarda sólo el hash del token: si alguien
 * leyera la tabla, no podría hacerse pasar por un usuario.
 */
export const PANEL_COOKIE = "s124_panel";
export const CLIENT_COOKIE = "s124_client";

const PANEL_DAYS = 7;
const CLIENT_DAYS = 30;

type HonoEnv = { Variables: Variables };

function cookieOptions(env: AppContext["env"], maxAgeDays: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}

export async function issueSession(
  ctx: AppContext,
  c: Context,
  subject: { type: "user" | "client"; id: string },
): Promise<void> {
  const token = randomToken();
  const days = subject.type === "user" ? PANEL_DAYS : CLIENT_DAYS;
  await ctx.db.insert(sessions).values({
    id: sha256(token),
    subjectType: subject.type,
    subjectId: subject.id,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  });
  const name = subject.type === "user" ? PANEL_COOKIE : CLIENT_COOKIE;
  setCookie(c, name, token, cookieOptions(ctx.env, days));
}

export async function destroySession(ctx: AppContext, c: Context, kind: "user" | "client"): Promise<void> {
  const name = kind === "user" ? PANEL_COOKIE : CLIENT_COOKIE;
  const token = getCookie(c, name);
  if (token) await ctx.db.delete(sessions).where(eq(sessions.id, sha256(token)));
  // Se borra con los mismos atributos con los que se creó; si no, el navegador la conserva.
  setCookie(c, name, "", { ...cookieOptions(ctx.env, 0), maxAge: 0 });
}

async function resolvePrincipal(db: Database, token: string | undefined): Promise<Principal | null> {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;

  if (session.subjectType === "user") {
    const [user] = await db.select().from(users).where(eq(users.id, session.subjectId)).limit(1);
    if (!user || !user.active) return null;
    return { kind: "user", id: user.id, role: user.role, name: user.name };
  }
  const [client] = await db.select().from(clients).where(eq(clients.id, session.subjectId)).limit(1);
  if (!client || client.status === "inactive") return null;
  return { kind: "client", id: client.id, name: client.name };
}

/** Carga el principal si hay sesión válida. No exige autenticación. */
export const withPrincipal = (ctx: AppContext) =>
  createMiddleware<HonoEnv>(async (c, next) => {
    const panel = await resolvePrincipal(ctx.db, getCookie(c, PANEL_COOKIE));
    const principal = panel ?? (await resolvePrincipal(ctx.db, getCookie(c, CLIENT_COOKIE)));
    if (principal) c.set("principal", principal);
    await next();
  });

export const requireStaff = createMiddleware<HonoEnv>(async (c, next) => {
  const principal = c.get("principal");
  if (!principal || principal.kind !== "user") throw new AppError("unauthorized", "Iniciá sesión en el panel.");
  await next();
});

export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const principal = c.get("principal");
  if (!principal || principal.kind !== "user") throw new AppError("unauthorized", "Iniciá sesión en el panel.");
  if (principal.role !== "admin") throw new AppError("forbidden", "Necesitás permisos de administración.");
  await next();
});

export const requireClient = createMiddleware<HonoEnv>(async (c, next) => {
  const principal = c.get("principal");
  if (!principal || principal.kind !== "client") throw new AppError("unauthorized", "Iniciá sesión para continuar.");
  await next();
});

export function staffOf(c: Context<HonoEnv>): { type: "user"; id: string } {
  const principal = c.get("principal");
  if (!principal || principal.kind !== "user") throw new AppError("unauthorized", "Sesión no válida.");
  return { type: "user", id: principal.id };
}

export function clientIdOf(c: Context<HonoEnv>): string {
  const principal = c.get("principal");
  if (!principal || principal.kind !== "client") throw new AppError("unauthorized", "Sesión no válida.");
  return principal.id;
}

/** Limpieza de sesiones vencidas; la ejecuta la tarea diaria. */
export async function purgeExpiredSessions(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
