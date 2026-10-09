import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cifrado de credenciales (Mercado Pago, emails) con AES-256-GCM.
 *
 * Por qué cifrar y no "hashear": un hash es de una sola vía y la API necesita volver a leer
 * el token para llamar a Mercado Pago. Las contraseñas sí se hashean (ver password.ts).
 * Formato guardado: base64(iv[12] | tag[16] | ciphertext).
 */
export class SecretBox {
  readonly #key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY debe ser de 32 bytes en base64.");
    this.#key = key;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }

  decrypt(stored: string): string {
    const raw = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.#key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  }
}

export function newEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}

/** Token aleatorio para sesiones y referencias externas (no adivinable). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Pista para mostrar una credencial guardada sin revelarla: "••••1234". */
export function secretHint(plain: string): string {
  return `••••${plain.slice(-4)}`;
}
