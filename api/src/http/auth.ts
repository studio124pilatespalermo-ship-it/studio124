import { and, eq, gt, lt } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { Database } from "../db/client.ts";
import { clients, sessions, users } from "../db/schema.ts";
import { randomToken, sha256 } from "../lib/crypto.ts";
import { AppError } from "../lib/errors.ts";
import type { AppContext, ClientPrincipal, StaffPrincipal, Variables } from "./context.ts";

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

async function subjectOf(db: Database, token: string | undefined, kind: "user" | "client"): Promise<string | null> {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session || session.subjectType !== kind) return null;
  return session.subjectId;
}

async function resolveStaff(db: Database, token: string | undefined): Promise<StaffPrincipal | null> {
  const id = await subjectOf(db, token, "user");
  if (!id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user || !user.active) return null;
  return { kind: "user", id: user.id, role: user.role, name: user.name };
}

async function resolveClient(db: Database, token: string | undefined): Promise<ClientPrincipal | null> {
  const id = await subjectOf(db, token, "client");
  if (!id) return null;
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client || client.status === "inactive") return null;
  return { kind: "client", id: client.id, name: client.name };
}

/**
 * Carga las sesiones que haya, cada una en su variable. No exige autenticación: eso lo
 * hacen requireStaff y requireClient, que miran sólo la suya.
 */
export const withPrincipal = (ctx: AppContext) =>
  createMiddleware<HonoEnv>(async (c, next) => {
    const [staff, client] = await Promise.all([
      resolveStaff(ctx.db, getCookie(c, PANEL_COOKIE)),
      resolveClient(ctx.db, getCookie(c, CLIENT_COOKIE)),
    ]);
    if (staff) c.set("staff", staff);
    if (client) c.set("client", client);
    await next();
  });

export const requireStaff = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.get("staff")) throw new AppError("unauthorized", "Iniciá sesión en el panel.");
  await next();
});

export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const staff = c.get("staff");
  if (!staff) throw new AppError("unauthorized", "Iniciá sesión en el panel.");
  if (staff.role !== "admin") throw new AppError("forbidden", "Necesitás permisos de administración.");
  await next();
});

export const requireClient = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.get("client")) throw new AppError("unauthorized", "Iniciá sesión para continuar.");
  await next();
});

export function staffOf(c: Context<HonoEnv>): { type: "user"; id: string } {
  const staff = c.get("staff");
  if (!staff) throw new AppError("unauthorized", "Sesión no válida.");
  return { type: "user", id: staff.id };
}

export function clientIdOf(c: Context<HonoEnv>): string {
  const client = c.get("client");
  if (!client) throw new AppError("unauthorized", "Sesión no válida.");
  return client.id;
}

/** Limpieza de sesiones vencidas; la ejecuta la tarea diaria. */
export async function purgeExpiredSessions(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
