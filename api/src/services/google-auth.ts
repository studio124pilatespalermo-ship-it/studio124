import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { clients } from "../db/schema.ts";
import { AppError } from "../lib/errors.ts";

/**
 * Ingreso de clientes con Google (OAuth 2.0, flujo de código de autorización).
 *
 * El estudio decide si una persona nueva puede crearse la cuenta sola
 * (`portal.allowSelfSignup`). Si está apagado, sólo entran quienes ya figuran como
 * clientes: se los reconoce por email y se les asocia la cuenta de Google.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function googleConfig(env: {
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
  PUBLIC_API_URL: string;
}): GoogleConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.PUBLIC_API_URL}/api/auth/google/callback`,
  };
}

/** URL a la que se manda al cliente. `state` protege contra CSRF y vuelve en el callback. */
export function authorizeUrl(config: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export interface GoogleProfile {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

export async function exchangeCode(config: GoogleConfig, code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new AppError("upstream_error", "Google rechazó el ingreso. Probá de nuevo.");
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) throw new AppError("upstream_error", "Google no devolvió un token de acceso.");

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!profileResponse.ok) throw new AppError("upstream_error", "No se pudo leer el perfil de Google.");
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
  if (!profile.sub || !profile.email) throw new AppError("upstream_error", "Google no devolvió un email.");
  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name ?? profile.email,
    emailVerified: profile.email_verified === true,
  };
}

/**
 * Encuentra al cliente por su cuenta de Google o por email, y lo crea si el estudio
 * habilitó el alta propia. Devuelve `null` cuando no corresponde dejarlo entrar.
 */
export async function findOrCreateClient(
  db: Database,
  profile: GoogleProfile,
  allowSelfSignup: boolean,
): Promise<{ id: string } | null> {
  const [bySub] = await db.select().from(clients).where(eq(clients.googleSub, profile.sub)).limit(1);
  if (bySub) {
    if (bySub.status === "inactive") return null;
    return { id: bySub.id };
  }

  // Se exige el email verificado para no dejar que alguien reclame la cuenta de otro.
  if (!profile.emailVerified) return null;

  const [byEmail] = await db
    .select()
    .from(clients)
    .where(sql`lower(${clients.email}) = ${profile.email}`)
    .limit(1);
  if (byEmail) {
    if (byEmail.status === "inactive") return null;
    await db.update(clients).set({ googleSub: profile.sub, updatedAt: new Date() }).where(eq(clients.id, byEmail.id));
    return { id: byEmail.id };
  }

  if (!allowSelfSignup) return null;

  const [created] = await db
    .insert(clients)
    .values({ name: profile.name, email: profile.email, googleSub: profile.sub })
    .returning({ id: clients.id });
  return created ?? null;
}
