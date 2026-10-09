import { openDatabase, type Database } from "../src/db/client.ts";
import { newEncryptionKey, SecretBox } from "../src/lib/crypto.ts";
import { createContext, type AppContext } from "../src/http/context.ts";
import { paymentCategories, paymentMethods, professionals, templateSlots, users } from "../src/db/schema.ts";
import { hashPassword } from "../src/lib/password.ts";
import type { Env } from "../src/config/env.ts";

export interface TestEnvironment {
  readonly db: Database;
  readonly ctx: AppContext;
  readonly close: () => Promise<void>;
}

/** Base PGlite en memoria: cada test arranca con un esquema limpio y real de Postgres. */
export async function createTestEnv(): Promise<TestEnvironment> {
  const handle = await openDatabase({ dataDir: "memory://" });
  const env: Env = {
    NODE_ENV: "test",
    PORT: 0,
    APP_ENCRYPTION_KEY: newEncryptionKey(),
    PUBLIC_SITE_URL: "https://studio124.test",
    PUBLIC_API_URL: "https://api.studio124.test",
  };
  return { db: handle.db, ctx: createContext(handle.db, env), close: handle.close };
}

export const box = () => new SecretBox(newEncryptionKey());

export async function seedBasics(db: Database) {
  const [method] = await db.insert(paymentMethods).values({ code: "cash", name: "Efectivo" }).returning();
  const [professional] = await db.insert(professionals).values({ name: "Karina" }).returning();
  const [category] = await db
    .insert(paymentCategories)
    .values({ name: "Pack 4 clases", kind: "pack", classes: 4, validityDays: 30, priceMinor: 4000000 })
    .returning();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@studio124.test", name: "Admin", role: "admin", passwordHash: await hashPassword("clave-larga-de-prueba") })
    .returning();
  return { method: method!, professional: professional!, category: category!, admin: admin! };
}

export async function seedTemplate(db: Database, options: { weekday: number; startTime: string; capacity?: number }) {
  const [slot] = await db
    .insert(templateSlots)
    .values({
      weekday: options.weekday,
      startTime: options.startTime,
      durationMin: 55,
      capacity: options.capacity ?? 6,
    })
    .returning();
  return slot!;
}
