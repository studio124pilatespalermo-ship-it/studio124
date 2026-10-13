import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clients, users } from "../src/db/schema.ts";
import { hashPassword } from "../src/lib/password.ts";
import { createApp } from "../src/http/app.ts";
import { createContext } from "../src/http/context.ts";
import { newEncryptionKey } from "../src/lib/crypto.ts";
import { openDatabase } from "../src/db/client.ts";
import type { Env } from "../src/config/env.ts";

/** Levanta la app completa en memoria para probar rutas y permisos de verdad. */
async function createServer(nodeEnv: Env["NODE_ENV"]) {
  const handle = await openDatabase({ dataDir: "memory://" });
  const env: Env = {
    NODE_ENV: nodeEnv,
    PORT: 0,
    APP_ENCRYPTION_KEY: newEncryptionKey(),
    PUBLIC_SITE_URL: "https://studio124.test",
    PUBLIC_API_URL: "https://api.studio124.test",
    ...(nodeEnv === "production" ? { DATABASE_URL: "postgres://noop" } : {}),
  };
  return { app: createApp(createContext(handle.db, env)), db: handle.db, close: handle.close };
}

let server: Awaited<ReturnType<typeof createServer>>;

afterEach(async () => {
  await server?.close();
});

describe("ingreso de prueba del portal", () => {
  beforeEach(async () => {
    server = await createServer("development");
  });

  it("en desarrollo deja entrar a un cliente existente", async () => {
    await server.db.insert(clients).values({ name: "Ana", email: "Ana@Ejemplo.test" });
    const response = await server.app.request("/api/auth/client/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana@ejemplo.test" }),
    });
    expect(response.status).toBe(200);
    // La sesión viaja en cookie HttpOnly, nunca en el cuerpo.
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.text()).not.toContain("password");
  });

  it("falla con un email que no es de ningún cliente", async () => {
    const response = await server.app.request("/api/auth/client/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nadie@ejemplo.test" }),
    });
    expect(response.status).toBe(404);
  });
});

describe("sesiones de panel y de portal a la vez", () => {
  beforeEach(async () => {
    server = await createServer("development");
  });

  /**
   * La administradora suele tener el panel abierto y entrar también como clienta. Antes
   * la sesión de panel tapaba la de cliente y el portal devolvía 401.
   */
  it("una no tapa a la otra", async () => {
    await server.db.insert(users).values({
      email: "admin@studio124.test",
      name: "Admin",
      role: "admin",
      passwordHash: await hashPassword("clave-larga-de-prueba"),
    });
    await server.db.insert(clients).values({ name: "Ana", email: "ana@ejemplo.test" });

    const panelLogin = await server.app.request("/api/auth/panel/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@studio124.test", password: "clave-larga-de-prueba" }),
    });
    const clientLogin = await server.app.request("/api/auth/client/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana@ejemplo.test" }),
    });

    const cookie = [panelLogin, clientLogin]
      .map((response) => response.headers.getSetCookie()[0]?.split(";")[0])
      .join("; ");

    const panel = await server.app.request("/api/auth/panel/me", { headers: { cookie } });
    const portal = await server.app.request("/api/portal/me", { headers: { cookie } });
    expect(panel.status).toBe(200);
    expect(portal.status).toBe(200);
    const body = (await portal.json()) as { client: { name: string } };
    expect(body.client.name).toBe("Ana");
  });
});

describe("producción", () => {
  beforeEach(async () => {
    server = await createServer("production");
  });

  it("no expone el ingreso de prueba", async () => {
    await server.db.insert(clients).values({ name: "Ana", email: "ana@ejemplo.test" });
    const response = await server.app.request("/api/auth/client/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana@ejemplo.test" }),
    });
    expect(response.status).toBe(404);
  });
});

describe("permisos", () => {
  beforeEach(async () => {
    server = await createServer("development");
  });

  it("las rutas del panel exigen sesión de panel", async () => {
    for (const path of ["/api/clients", "/api/payments", "/api/schedule/template", "/api/settings/secrets"]) {
      const response = await server.app.request(path);
      expect(response.status, path).toBe(401);
    }
  });

  it("las rutas del portal exigen sesión de cliente", async () => {
    for (const path of ["/api/portal/me", "/api/portal/bookings", "/api/portal/categories"]) {
      const response = await server.app.request(path);
      expect(response.status, path).toBe(401);
    }
  });

  it("la configuración del portal es pública: la landing la necesita sin sesión", async () => {
    const response = await server.app.request("/api/portal/config");
    expect(response.status).toBe(200);
  });

  it("las tareas diarias no corren sin el token", async () => {
    const response = await server.app.request("/api/tasks/daily", { method: "POST" });
    expect([401, 503]).toContain(response.status);
  });

  it("el webhook responde 200 aunque el aviso sea inválido, para no provocar reintentos", async () => {
    const response = await server.app.request("/api/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment", data: { id: "123" } }),
    });
    expect(response.status).toBe(200);
  });
});

describe("precios del catálogo", () => {
  beforeEach(async () => {
    server = await createServer("development");
  });

  async function adminCookie(): Promise<string> {
    await server.db.insert(users).values({
      email: "admin@studio124.test",
      name: "Admin",
      role: "admin",
      passwordHash: await hashPassword("clave-larga-de-prueba"),
    });
    const login = await server.app.request("/api/auth/panel/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@studio124.test", password: "clave-larga-de-prueba" }),
    });
    return login.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  }

  async function createCategory(cookie: string, body: Record<string, unknown>) {
    const response = await server.app.request("/api/catalog/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ kind: "pack", classes: 4, validityDays: 28, priceMinor: 4_000_000, ...body }),
    });
    return ((await response.json()) as { category: { id: string } }).category.id;
  }

  /** Antes, `{ active: false }` también ponía `sellOnline` en false por el default de zod. */
  it("editar un campo no pisa los demás", async () => {
    const cookie = await adminCookie();
    const id = await createCategory(cookie, { name: "Pack 4", sellOnline: true, showOnLanding: true });
    const response = await server.app.request(`/api/catalog/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ priceMinor: 4_500_000 }),
    });
    const { category } = (await response.json()) as {
      category: { priceMinor: number; sellOnline: boolean; showOnLanding: boolean; active: boolean };
    };
    expect(category).toMatchObject({ priceMinor: 4_500_000, sellOnline: true, showOnLanding: true, active: true });
  });

  it("la landing ve sólo lo marcado y activo, sin sesión", async () => {
    const cookie = await adminCookie();
    await createCategory(cookie, { name: "Pack 4", showOnLanding: true, sortOrder: 2 });
    await createCategory(cookie, { name: "Clase suelta", kind: "single", classes: 1, showOnLanding: true, sortOrder: 1 });
    await createCategory(cookie, { name: "Interna", showOnLanding: false });
    await createCategory(cookie, { name: "Vieja", showOnLanding: true, active: false });

    const response = await server.app.request("/api/public/prices");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    const { prices } = (await response.json()) as { prices: { kind: string; classes: number }[] };
    expect(prices.map((price) => [price.kind, price.classes])).toEqual([
      ["single", 1],
      ["pack", 4],
    ]);
    // No viaja el nombre interno ni ningún dato de configuración.
    expect(JSON.stringify(prices)).not.toContain("Interna");
    expect(Object.keys(prices[0] ?? {})).not.toContain("name");
  });
});
