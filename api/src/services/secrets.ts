import { eq } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { secrets } from "../db/schema.ts";
import { AppError } from "../lib/errors.ts";
import { SecretBox, secretHint } from "../lib/crypto.ts";

/**
 * Credenciales de integraciones, cargadas desde /admin → Configuración → Credenciales.
 *
 * Se guardan cifradas (AES-256-GCM) con `APP_ENCRYPTION_KEY`. La API nunca devuelve el valor:
 * al panel sólo le informa si está cargada, su pista ("••••1234") y cuándo se actualizó.
 */
export const SECRET_KEYS = {
  MP_ACCESS_TOKEN: "Mercado Pago · Access Token de producción",
  MP_WEBHOOK_SECRET: "Mercado Pago · Clave secreta del webhook",
  MP_PUBLIC_KEY: "Mercado Pago · Public Key (opcional)",
  RESEND_API_KEY: "Emails · API key de Resend",
  RESEND_FROM: "Emails · Remitente (ej. Studio124 <hola@studio124.com.ar>)",
} as const;

export type SecretKey = keyof typeof SECRET_KEYS;

export const isSecretKey = (value: string): value is SecretKey => value in SECRET_KEYS;

export interface SecretStatus {
  readonly key: SecretKey;
  readonly label: string;
  readonly configured: boolean;
  readonly hint: string | null;
  readonly updatedAt: Date | null;
}

export class SecretStore {
  readonly #db: Database;
  readonly #box: SecretBox;

  constructor(db: Database, box: SecretBox) {
    this.#db = db;
    this.#box = box;
  }

  async list(): Promise<SecretStatus[]> {
    const rows = await this.#db.select().from(secrets);
    const stored = new Map(rows.map((row) => [row.key, row]));
    return (Object.keys(SECRET_KEYS) as SecretKey[]).map((key) => {
      const row = stored.get(key);
      return {
        key,
        label: SECRET_KEYS[key],
        configured: row !== undefined,
        hint: row?.hint ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async get(key: SecretKey): Promise<string | null> {
    const [row] = await this.#db.select().from(secrets).where(eq(secrets.key, key)).limit(1);
    if (!row) return null;
    try {
      return this.#box.decrypt(row.ciphertext);
    } catch {
      // Pasa si cambió APP_ENCRYPTION_KEY: hay que volver a cargar la credencial.
      throw new AppError("not_configured", `La credencial ${key} no se puede descifrar. Volvé a cargarla.`);
    }
  }

  /** Igual que `get`, pero falla con un mensaje claro si la credencial no está cargada. */
  async require(key: SecretKey): Promise<string> {
    const value = await this.get(key);
    if (!value) {
      throw new AppError("not_configured", `Falta cargar "${SECRET_KEYS[key]}" en Configuración → Credenciales.`);
    }
    return value;
  }

  async set(key: SecretKey, plain: string, updatedBy?: string): Promise<void> {
    const value = plain.trim();
    if (!value) throw new AppError("bad_request", "La credencial no puede estar vacía.");
    const row = {
      key,
      ciphertext: this.#box.encrypt(value),
      hint: secretHint(value),
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    };
    await this.#db.insert(secrets).values(row).onConflictDoUpdate({ target: secrets.key, set: row });
  }

  async remove(key: SecretKey): Promise<void> {
    await this.#db.delete(secrets).where(eq(secrets.key, key));
  }
}
