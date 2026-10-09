import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.ts";
import { settings } from "../db/schema.ts";

/**
 * Reglas y preferencias editables desde /admin → Configuración. Cada clave tiene su esquema
 * y su valor por defecto: una clave ausente o inválida no rompe la app, usa el default.
 */
export const SETTINGS_SCHEMA = {
  "booking.changeWindowHours": z.number().int().min(0).max(168).default(2),
  "booking.cancelWindowHours": z.number().int().min(0).max(168).default(2),
  /** Con cuánta anticipación máxima puede reservar un cliente. */
  "booking.horizonDays": z.number().int().min(1).max(180).default(30),
  "schedule.defaultDurationMin": z.number().int().min(15).max(180).default(55),
  "schedule.defaultCapacity": z.number().int().min(1).max(30).default(6),
  /** El portal del cliente permite reservar, no sólo mirar. */
  "portal.allowBooking": z.boolean().default(true),
  "portal.allowSelfSignup": z.boolean().default(false),
  "portal.showAvailableSlots": z.boolean().default(true),
  "portal.showPayments": z.boolean().default(true),
  "portal.allowOnlinePayment": z.boolean().default(true),
  /** La instructora puede marcar asistencia y ausencias. */
  "staff.canMarkAttendance": z.boolean().default(true),
  "notifications.expiryEmail": z.boolean().default(true),
  "studio.name": z.string().min(1).default("Studio124"),
  "studio.timezoneNote": z.string().default("Hora de Buenos Aires (UTC−3)"),
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type SettingValues = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };

export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

function parseValue<K extends SettingKey>(key: K, raw: unknown): SettingValues[K] {
  const parsed = SETTINGS_SCHEMA[key].safeParse(raw);
  return (parsed.success ? parsed.data : SETTINGS_SCHEMA[key].parse(undefined)) as SettingValues[K];
}

export function defaults(): SettingValues {
  return Object.fromEntries(SETTING_KEYS.map((key) => [key, parseValue(key, undefined)])) as SettingValues;
}

export async function readSettings(db: Database): Promise<SettingValues> {
  const rows = await db.select().from(settings).where(inArray(settings.key, SETTING_KEYS));
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, parseValue(key, stored.has(key) ? stored.get(key) : undefined)]),
  ) as SettingValues;
}

export async function writeSettings(db: Database, patch: Partial<SettingValues>): Promise<SettingValues> {
  const entries = Object.entries(patch).filter(([key]) => SETTING_KEYS.includes(key as SettingKey));
  for (const [key, value] of entries) {
    const validated = SETTINGS_SCHEMA[key as SettingKey].parse(value);
    await db
      .insert(settings)
      .values({ key, value: validated })
      .onConflictDoUpdate({ target: settings.key, set: { value: validated, updatedAt: new Date() } });
  }
  return readSettings(db);
}

/** Esquema para validar el cuerpo del PATCH de configuración. */
export const settingsPatchSchema = z
  .object(Object.fromEntries(SETTING_KEYS.map((key) => [key, SETTINGS_SCHEMA[key].optional()])))
  .strict();

export async function clearSetting(db: Database, key: SettingKey): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
