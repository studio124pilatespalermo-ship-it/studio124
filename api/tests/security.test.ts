import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newEncryptionKey, SecretBox, secretHint } from "../src/lib/crypto.ts";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import { verifySignature } from "../src/services/mercadopago.ts";
import { SecretStore } from "../src/services/secrets.ts";
import { createTestEnv, type TestEnvironment } from "./helpers.ts";

let env: TestEnvironment;

beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.close();
});

const SECRET = "clave-de-webhook-de-prueba";

function sign(input: { dataId: string; requestId: string; ts: string; secret?: string }): string {
  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${input.ts};`;
  const v1 = createHmac("sha256", input.secret ?? SECRET).update(manifest).digest("hex");
  return `ts=${input.ts},v1=${v1}`;
}

describe("firma del webhook de Mercado Pago", () => {
  const dataId = "123456789";
  const requestId = "req-abc";
  const ts = "1760000000";

  it("acepta una firma válida", () => {
    const signature = sign({ dataId, requestId, ts });
    expect(verifySignature({ signature, requestId, dataId, secret: SECRET })).toEqual({ valid: true });
  });

  it("rechaza una firma hecha con otro secreto", () => {
    const signature = sign({ dataId, requestId, ts, secret: "otro-secreto" });
    expect(verifySignature({ signature, requestId, dataId, secret: SECRET })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rechaza si cambia el id del pago", () => {
    const signature = sign({ dataId, requestId, ts });
    const result = verifySignature({ signature, requestId, dataId: "999", secret: SECRET });
    expect(result.valid).toBe(false);
  });

  it("rechaza cuando falta la cabecera o tiene otro formato", () => {
    expect(verifySignature({ signature: undefined, requestId, dataId, secret: SECRET })).toEqual({
      valid: false,
      reason: "missing",
    });
    expect(verifySignature({ signature: "ts=1", requestId, dataId, secret: SECRET })).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("normaliza a minúsculas el id alfanumérico, como hace Mercado Pago", () => {
    const manifest = `id:abc123;request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
    const result = verifySignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId: "ABC123", secret: SECRET });
    expect(result).toEqual({ valid: true });
  });
});

describe("credenciales guardadas", () => {
  it("se cifran y se recuperan, y nunca se exponen en el listado", async () => {
    const key = newEncryptionKey();
    const store = new SecretStore(env.db, new SecretBox(key));
    const token = "APP_USR-token-secreto-de-prueba-1234";

    await store.set("MP_ACCESS_TOKEN", token);
    expect(await store.get("MP_ACCESS_TOKEN")).toBe(token);

    const listed = await store.list();
    const entry = listed.find((item) => item.key === "MP_ACCESS_TOKEN");
    expect(entry?.configured).toBe(true);
    expect(entry?.hint).toBe("••••1234");
    expect(JSON.stringify(listed)).not.toContain(token);
  });

  it("una credencial ausente falla con un mensaje que indica dónde cargarla", async () => {
    const store = new SecretStore(env.db, new SecretBox(newEncryptionKey()));
    await expect(store.require("MP_WEBHOOK_SECRET")).rejects.toThrow(/Configuración → Credenciales/);
  });

  it("no se puede descifrar con otra clave maestra", async () => {
    const store = new SecretStore(env.db, new SecretBox(newEncryptionKey()));
    await store.set("RESEND_API_KEY", "re_clave_de_prueba");
    const otherStore = new SecretStore(env.db, new SecretBox(newEncryptionKey()));
    await expect(otherStore.get("RESEND_API_KEY")).rejects.toThrow(/volvé a cargarla/i);
  });

  it("la pista sólo muestra los últimos cuatro caracteres", () => {
    expect(secretHint("abcdefghij")).toBe("••••ghij");
  });
});

describe("contraseñas", () => {
  it("se guardan hasheadas y verifican sólo con la correcta", async () => {
    const stored = await hashPassword("clave-larga-de-prueba");
    expect(stored).not.toContain("clave-larga-de-prueba");
    expect(await verifyPassword(stored, "clave-larga-de-prueba")).toBe(true);
    expect(await verifyPassword(stored, "otra-clave")).toBe(false);
    expect(await verifyPassword("no-es-un-hash", "clave-larga-de-prueba")).toBe(false);
  });
});
