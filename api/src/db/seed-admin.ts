import { eq } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../lib/password.ts";
import { openDatabase } from "./client.ts";
import { paymentMethods, users } from "./schema.ts";

/**
 * Crea (o actualiza) el usuario administrador y los medios de pago base.
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:admin
 *
 * La contraseña nunca se guarda en el repositorio ni se imprime.
 */
const env = loadEnv();
const email = process.env["SEED_ADMIN_EMAIL"]?.trim().toLowerCase();
const password = process.env["SEED_ADMIN_PASSWORD"];

if (!email || !password) {
  console.error("Faltan SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD.");
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`La contraseña necesita al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  process.exit(1);
}

const handle = await openDatabase({ url: env.DATABASE_URL, dataDir: "./.data/pg" });
const passwordHash = await hashPassword(password);

const [existing] = await handle.db.select().from(users).where(eq(users.email, email)).limit(1);
if (existing) {
  await handle.db.update(users).set({ passwordHash, role: "admin", active: true }).where(eq(users.id, existing.id));
  console.log(`[seed] contraseña actualizada para ${email}.`);
} else {
  await handle.db.insert(users).values({
    email,
    name: process.env["SEED_ADMIN_NAME"] ?? "Administración",
    role: "admin",
    passwordHash,
  });
  console.log(`[seed] administrador creado: ${email}.`);
}

const METHODS = [
  { code: "cash", name: "Efectivo" },
  { code: "mercado_pago", name: "Mercado Pago" },
  { code: "transfer", name: "Transferencia" },
  { code: "other", name: "Otro (extranjeros)" },
];
for (const method of METHODS) {
  await handle.db.insert(paymentMethods).values(method).onConflictDoNothing();
}
console.log("[seed] medios de pago listos.");

await handle.close();
