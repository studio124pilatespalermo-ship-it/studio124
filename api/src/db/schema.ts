import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Esquema de la base. Convenciones:
 * - Dinero en unidades menores enteras (`*_minor`) con moneda explícita.
 * - Fechas de agenda en hora de Buenos Aires: `date` (YYYY-MM-DD) + `start_time` (HH:MM).
 *   Los instantes (creación, sesiones) en `timestamptz`.
 * - Bajas lógicas (`deleted_at` / estado), nunca borrado físico desde el panel.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum("user_role", ["admin", "staff"]);
export const clientStatus = pgEnum("client_status", ["active", "inactive"]);
export const categoryKind = pgEnum("category_kind", ["trial", "single", "single_duo", "pack", "monthly"]);
export const packStatus = pgEnum("pack_status", ["pending", "active", "expired", "cancelled"]);
export const creditReason = pgEnum("credit_reason", ["loaded", "booked", "refunded", "adjustment", "expired"]);
export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "attended",
  "absent",
  "cancelled_on_time",
  "cancelled_late",
]);
export const bookingSource = pgEnum("booking_source", ["fixed", "admin", "client", "change"]);
export const slotStatus = pgEnum("slot_status", ["scheduled", "cancelled"]);
export const subjectType = pgEnum("subject_type", ["user", "client"]);

/** Usuarios del panel: administradora e instructoras. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("staff"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Sesiones de panel y de clientes. Se guarda el hash del token, nunca el token. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    subjectType: subjectType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_subject_idx").on(t.subjectType, t.subjectId)],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    googleSub: text("google_sub").unique(),
    status: clientStatus("status").notNull().default("active"),
    notes: text("notes"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("clients_email_unique").on(sql`lower(${t.email})`), index("clients_status_idx").on(t.status)],
);

export const professionals = pgTable("professionals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const paymentCategories = pgTable("payment_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: categoryKind("kind").notNull(),
  classes: smallint("classes").notNull(),
  validityDays: smallint("validity_days").notNull(),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull().default("ARS"),
  /** Se ofrece en el portal del cliente para pagar con Mercado Pago. */
  sellOnline: boolean("sell_online").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

/** Un pago registrado: da créditos (clases) con vigencia. */
export const packs = pgTable(
  "packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    categoryId: uuid("category_id").notNull().references(() => paymentCategories.id),
    methodId: uuid("method_id").notNull().references(() => paymentMethods.id),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("ARS"),
    classesTotal: smallint("classes_total").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: packStatus("status").notNull().default("active"),
    mpPaymentId: text("mp_payment_id").unique(),
    note: text("note"),
    expiryNotifiedAt: timestamp("expiry_notified_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("packs_client_idx").on(t.clientId), index("packs_status_ends_idx").on(t.status, t.endsOn)],
);

/** Libro de movimientos de créditos: el saldo de un pack es la suma de `delta`. */
export const creditMovements = pgTable(
  "credit_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id").notNull().references(() => packs.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    delta: smallint("delta").notNull(),
    reason: creditReason("reason").notNull(),
    bookingId: uuid("booking_id"),
    note: text("note"),
    actorType: subjectType("actor_type"),
    actorId: uuid("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [index("credit_movements_pack_idx").on(t.packId)],
);

/** Agenda modelo: la semana tipo. weekday ISO: 1 = lunes … 7 = domingo. */
export const templateSlots = pgTable("template_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekday: smallint("weekday").notNull(),
  startTime: text("start_time").notNull(),
  durationMin: smallint("duration_min").notNull(),
  capacity: smallint("capacity").notNull(),
  professionalId: uuid("professional_id").references(() => professionals.id),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/** Turnos fijos de cada cliente sobre la agenda modelo. */
export const fixedAssignments = pgTable(
  "fixed_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    templateSlotId: uuid("template_slot_id").notNull().references(() => templateSlots.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("fixed_assignments_unique").on(t.clientId, t.templateSlotId)],
);

/** Turnos reales de la agenda del mes. */
export const classSlots = pgTable(
  "class_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    startTime: text("start_time").notNull(),
    durationMin: smallint("duration_min").notNull(),
    capacity: smallint("capacity").notNull(),
    professionalId: uuid("professional_id").references(() => professionals.id),
    templateSlotId: uuid("template_slot_id").references(() => templateSlots.id),
    status: slotStatus("status").notNull().default("scheduled"),
    createdAt: createdAt(),
  },
  (t) => [
    // "Generar mes" es idempotente gracias a este índice: nunca duplica ni pisa un turno ya creado.
    uniqueIndex("class_slots_template_date_unique").on(t.templateSlotId, t.date),
    index("class_slots_date_idx").on(t.date),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classSlotId: uuid("class_slot_id").notNull().references(() => classSlots.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    packId: uuid("pack_id").notNull().references(() => packs.id),
    status: bookingStatus("status").notNull().default("booked"),
    source: bookingSource("source").notNull(),
    changedFromId: uuid("changed_from_id"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_active_unique")
      .on(t.classSlotId, t.clientId)
      .where(sql`${t.status} in ('booked', 'attended', 'absent')`),
    index("bookings_client_idx").on(t.clientId),
    index("bookings_slot_idx").on(t.classSlotId),
  ],
);

export const holidays = pgTable("holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull().unique(),
  name: text("name").notNull(),
});

/** Reglas y preferencias editables desde el panel. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

/** Credenciales de integraciones, cifradas con AES-256-GCM (nunca en claro). */
export const secrets = pgTable("secrets", {
  key: text("key").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  hint: text("hint").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: updatedAt(),
});

/** Inicios de pago con Mercado Pago, para conciliar el webhook con el cliente y la categoría. */
export const checkouts = pgTable("checkouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalReference: text("external_reference").notNull().unique(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  categoryId: uuid("category_id").notNull().references(() => paymentCategories.id),
  preferenceId: text("preference_id"),
  packId: uuid("pack_id").references(() => packs.id),
  status: text("status").notNull().default("created"),
  createdAt: createdAt(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id),
  kind: text("kind").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

/** Auditoría de acciones del panel y del portal. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: subjectType("actor_type"),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_created_idx").on(t.createdAt)],
);
