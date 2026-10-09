import { z } from "zod";

/**
 * Variables de entorno, validadas al arrancar. Si falta algo obligatorio la API no levanta:
 * es preferible un arranque fallido a cobrar sin registrar el pago.
 *
 * Las credenciales de integraciones (Mercado Pago, emails) NO van acá: se cargan desde
 * /admin → Configuración → Credenciales y se guardan cifradas en la base.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  /** Postgres. Vacía en desarrollo = base embebida en disco (PGlite) en ./.data. */
  DATABASE_URL: z.string().optional(),

  /** Clave maestra para cifrar credenciales (32 bytes en base64). `npm run secret:new` genera una. */
  APP_ENCRYPTION_KEY: z.string().min(40),

  /** Dirección pública del sitio (landing, /admin, /cuenta). Ej. https://studio124.com.ar */
  PUBLIC_SITE_URL: z.url(),
  /** Dirección pública de esta API, para el webhook de Mercado Pago. Ej. https://api.studio124.com.ar */
  PUBLIC_API_URL: z.url(),

  /** Google OAuth para el ingreso de clientes. Opcionales: sin ellas el botón de Google no se ofrece. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** Secreto para disparar las tareas diarias desde un cron externo. Opcional. */
  CRON_SECRET: z.string().min(24).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Configuración inválida de la API:\n${detail}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.DATABASE_URL) {
    throw new Error("Configuración inválida de la API:\n- DATABASE_URL es obligatoria en producción.");
  }
  return parsed.data;
}
