import { eq } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { openDatabase } from "./client.ts";
import {
  clients,
  fixedAssignments,
  paymentCategories,
  paymentMethods,
  professionals,
  templateSlots,
} from "./schema.ts";
import { createBooking } from "../services/bookings.ts";
import { registerPayment, suggestSlots } from "../services/packs.ts";
import { generateMonth } from "../services/schedule.ts";
import { todayInStudio } from "../lib/dates.ts";

/**
 * Datos de demostración para probar el sistema de punta a punta.
 *
 *   npm run seed:demo
 *
 * IMPORTANTE: con la base embebida (sin DATABASE_URL), parar antes el servidor.
 * PGlite abre el directorio en exclusiva y dos procesos terminan con copias distintas.
 */
const env = loadEnv();
if (env.NODE_ENV === "production") {
  console.error("Este script no se ejecuta en producción.");
  process.exit(1);
}

const handle = await openDatabase({ url: env.DATABASE_URL, dataDir: "./.data/pg" });
const db = handle.db;

const [professional] = await db.insert(professionals).values({ name: "Karina" }).returning();

const CATEGORIES = [
  { name: "Clase de prueba", kind: "trial" as const, classes: 1, validityDays: 15, priceMinor: 0, sellOnline: false },
  { name: "Clase única", kind: "single" as const, classes: 1, validityDays: 30, priceMinor: 1_200_000, sellOnline: true },
  { name: "Pack 4 clases", kind: "pack" as const, classes: 4, validityDays: 30, priceMinor: 4_000_000, sellOnline: true },
  { name: "Pack 8 clases", kind: "pack" as const, classes: 8, validityDays: 30, priceMinor: 7_200_000, sellOnline: true },
  { name: "Pack 12 clases", kind: "pack" as const, classes: 12, validityDays: 30, priceMinor: 10_000_000, sellOnline: true },
];
const inserted = await db.insert(paymentCategories).values(CATEGORIES).returning();
const pack4 = inserted.find((category) => category.name === "Pack 4 clases");

// Agenda modelo: lunes a viernes por la mañana y por la tarde, sábado al mediodía.
const SLOTS: { weekday: number; times: string[] }[] = [
  { weekday: 1, times: ["08:00", "09:00", "10:00", "18:00", "19:00"] },
  { weekday: 2, times: ["08:00", "09:00", "10:00", "18:00", "19:00"] },
  { weekday: 3, times: ["08:00", "09:00", "10:00", "18:00", "19:00"] },
  { weekday: 4, times: ["08:00", "09:00", "10:00", "18:00", "19:00"] },
  { weekday: 5, times: ["08:00", "09:00", "10:00", "18:00", "19:00"] },
  { weekday: 6, times: ["09:00", "10:00", "11:00"] },
];
const templates = await db
  .insert(templateSlots)
  .values(
    SLOTS.flatMap(({ weekday, times }) =>
      times.map((startTime) => ({
        weekday,
        startTime,
        durationMin: 55,
        capacity: 6,
        professionalId: professional?.id ?? null,
      })),
    ),
  )
  .returning();

const today = todayInStudio();
const year = Number(today.slice(0, 4));
const month = Number(today.slice(5, 7));
const thisMonth = await generateMonth(db, { year, month });
const nextMonth = await generateMonth(db, {
  year: month === 12 ? year + 1 : year,
  month: month === 12 ? 1 : month + 1,
});
console.log(`[demo] turnos creados: ${thisMonth.created + nextMonth.created}`);

const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.code, "cash")).limit(1);
const PEOPLE = [
  { name: "Ana Gómez", email: "ana@ejemplo.test", weekday: 2, time: "10:00" },
  { name: "Sofía Pérez", email: "sofia@ejemplo.test", weekday: 4, time: "18:00" },
  { name: "Lucía Díaz", email: "lucia@ejemplo.test", weekday: 1, time: "08:00" },
];

for (const person of PEOPLE) {
  const [client] = await db.insert(clients).values({ name: person.name, email: person.email }).returning();
  if (!client || !pack4 || !method) continue;

  const template = templates.find((slot) => slot.weekday === person.weekday && slot.startTime === person.time);
  if (template) await db.insert(fixedAssignments).values({ clientId: client.id, templateSlotId: template.id });

  const pack = await registerPayment(db, {
    clientId: client.id,
    categoryId: pack4.id,
    methodId: method.id,
    startsOn: today,
  });

  const suggested = (await suggestSlots(db, pack.id)).filter((slot) => slot.available);
  for (const slot of suggested) {
    await createBooking(db, {
      clientId: client.id,
      slotId: slot.slotId,
      packId: pack.id,
      source: "fixed",
      by: { kind: "staff", actor: null },
    });
  }
  console.log(`[demo] ${person.name}: abono de 4 clases y ${suggested.length} turnos cargados.`);
}

await handle.close();
console.log("[demo] listo.");
