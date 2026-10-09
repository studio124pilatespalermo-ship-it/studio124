import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { bookings, classSlots, clients } from "../db/schema.ts";
import { slotStart, type IsoDate } from "../lib/dates.ts";
import { AppError, notFound } from "../lib/errors.ts";
import { consumeCredit, packForDate, refundCredit, type Actor } from "./credits.ts";
import { readSettings } from "./settings.ts";

/**
 * Reglas de reserva, cambio y cancelación.
 *
 * Criterio: el cliente sólo puede operar dentro de la ventana configurada; la administradora
 * puede hacerlo siempre, porque el panel es la válvula de escape para los casos que el sistema
 * no previó. Toda operación deja movimiento en el libro de créditos.
 */

export type BookingActor =
  | { readonly kind: "staff"; readonly actor: Actor }
  | { readonly kind: "client"; readonly clientId: string };

const ACTIVE = ["booked", "attended", "absent"] as const;

function actorOf(by: BookingActor): Actor {
  return by.kind === "staff" ? by.actor : { type: "client", id: by.clientId };
}

async function slotOrFail(db: Database, slotId: string) {
  const [slot] = await db.select().from(classSlots).where(eq(classSlots.id, slotId)).limit(1);
  if (!slot) throw notFound("Turno");
  if (slot.status === "cancelled") throw new AppError("conflict", "El turno está cancelado.");
  return slot;
}

async function takenSeats(db: Database, slotId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.classSlotId, slotId), inArray(bookings.status, [...ACTIVE])));
  return row?.count ?? 0;
}

/** Horas que faltan para que empiece el turno. Negativo si ya pasó. */
function hoursUntil(date: IsoDate, time: string, now: Date): number {
  return (slotStart(date, time).getTime() - now.getTime()) / 3_600_000;
}

/** Validaciones que sólo aplican al cliente; el panel las saltea a propósito. */
async function assertClientCanBook(db: Database, slot: { date: IsoDate; startTime: string }, now: Date): Promise<void> {
  const config = await readSettings(db);
  if (!config["portal.allowBooking"]) {
    throw new AppError("forbidden", "Las reservas desde el portal están desactivadas.");
  }
  if (hoursUntil(slot.date, slot.startTime, now) < config["booking.changeWindowHours"]) {
    throw new AppError("outside_window", "Ya pasó el plazo para reservar este turno.");
  }
}

async function assertSeatAvailable(db: Database, slotId: string, clientId: string, capacity: number): Promise<void> {
  const [already] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(eq(bookings.classSlotId, slotId), eq(bookings.clientId, clientId), inArray(bookings.status, [...ACTIVE])),
    )
    .limit(1);
  if (already) throw new AppError("conflict", "El cliente ya tiene lugar en ese turno.");
  if ((await takenSeats(db, slotId)) >= capacity) throw new AppError("slot_full", "El turno está completo.");
}

async function resolvePack(db: Database, clientId: string, date: IsoDate, packId?: string): Promise<string> {
  if (packId) return packId;
  const found = await packForDate(db, clientId, date);
  if (!found) throw new AppError("no_credits", "El cliente no tiene un abono vigente con clases disponibles.");
  return found.packId;
}

export interface BookInput {
  readonly clientId: string;
  readonly slotId: string;
  readonly by: BookingActor;
  readonly packId?: string | undefined;
  readonly source?: "fixed" | "admin" | "client" | "change" | undefined;
  readonly now?: Date | undefined;
}

export async function createBooking(db: Database, input: BookInput): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  const override = input.by.kind === "staff";
  const slot = await slotOrFail(db, input.slotId);

  const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
  if (!client) throw notFound("Cliente");
  if (!override) {
    if (client.status === "inactive") throw new AppError("forbidden", "El cliente está inactivo.");
    await assertClientCanBook(db, slot, now);
  }

  await assertSeatAvailable(db, input.slotId, input.clientId, slot.capacity);
  const packId = await resolvePack(db, input.clientId, slot.date, input.packId);

  const [created] = await db
    .insert(bookings)
    .values({
      classSlotId: input.slotId,
      clientId: input.clientId,
      packId,
      status: "booked",
      source: input.source ?? (override ? "admin" : "client"),
    })
    .returning({ id: bookings.id });
  if (!created) throw new AppError("conflict", "No se pudo crear la reserva.");

  await consumeCredit(db, {
    packId,
    clientId: input.clientId,
    date: slot.date,
    bookingId: created.id,
    actor: actorOf(input.by),
  });
  return created;
}

export interface CancelInput {
  readonly bookingId: string;
  readonly by: BookingActor;
  readonly now?: Date | undefined;
  /** Devuelve la clase aunque esté fuera de plazo (sólo panel, con motivo). */
  readonly refundAnyway?: boolean | undefined;
  readonly note?: string | undefined;
}

export async function cancelBooking(db: Database, input: CancelInput): Promise<{ refunded: boolean }> {
  const now = input.now ?? new Date();
  const override = input.by.kind === "staff";
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) throw notFound("Reserva");
  if (booking.status !== "booked") throw new AppError("conflict", "La reserva ya fue cerrada.");
  if (!override && booking.clientId !== input.by.clientId) {
    throw new AppError("forbidden", "La reserva es de otro cliente.");
  }

  const slot = await slotOrFail(db, booking.classSlotId);
  const config = await readSettings(db);
  const onTime = hoursUntil(slot.date, slot.startTime, now) >= config["booking.cancelWindowHours"];
  if (!override && !onTime) {
    throw new AppError("outside_window", "Ya pasó el plazo para cancelar: la clase se pierde.");
  }

  const refund = onTime || (override && input.refundAnyway === true);
  await db
    .update(bookings)
    .set({ status: refund ? "cancelled_on_time" : "cancelled_late", cancelledAt: now, updatedAt: now })
    .where(eq(bookings.id, booking.id));

  if (refund) {
    await refundCredit(db, {
      packId: booking.packId,
      clientId: booking.clientId,
      bookingId: booking.id,
      note: input.note,
      actor: actorOf(input.by),
    });
  }
  return { refunded: refund };
}

/** Cambiar de turno: cancela el actual y reserva el nuevo en una sola operación. */
export async function changeBooking(
  db: Database,
  input: { bookingId: string; toSlotId: string; by: BookingActor; now?: Date | undefined },
): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) throw notFound("Reserva");

  await cancelBooking(db, { bookingId: input.bookingId, by: input.by, now, note: "Cambio de turno" });
  const created = await createBooking(db, {
    clientId: booking.clientId,
    slotId: input.toSlotId,
    by: input.by,
    source: "change",
    now,
  });
  await db.update(bookings).set({ changedFromId: booking.id }).where(eq(bookings.id, created.id));
  return created;
}

/** Asistencia. Ausente = clase perdida: el crédito ya se consumió al reservar y no vuelve. */
export async function markAttendance(
  db: Database,
  input: { bookingId: string; status: "attended" | "absent" | "booked" },
): Promise<{ status: string }> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) throw notFound("Reserva");
  if (booking.status.startsWith("cancelled")) throw new AppError("conflict", "La reserva está cancelada.");
  await db.update(bookings).set({ status: input.status, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
  return { status: input.status };
}

export interface AgendaFilters {
  readonly from: IsoDate;
  readonly to: IsoDate;
  readonly professionalId?: string | undefined;
}

/** Agenda con lo que la vista necesita para sus indicadores (cambió de turno, ausente, vencido). */
export async function agenda(db: Database, filters: AgendaFilters) {
  const conditions = [sql`${classSlots.date} >= ${filters.from}`, sql`${classSlots.date} <= ${filters.to}`];
  if (filters.professionalId) conditions.push(eq(classSlots.professionalId, filters.professionalId));

  const slots = await db
    .select()
    .from(classSlots)
    .where(and(...conditions))
    .orderBy(classSlots.date, classSlots.startTime);
  if (slots.length === 0) return [];

  const rows = await db
    .select({
      id: bookings.id,
      slotId: bookings.classSlotId,
      clientId: bookings.clientId,
      clientName: clients.name,
      status: bookings.status,
      source: bookings.source,
      changedFromId: bookings.changedFromId,
      packId: bookings.packId,
    })
    .from(bookings)
    .innerJoin(clients, eq(clients.id, bookings.clientId))
    .where(
      inArray(
        bookings.classSlotId,
        slots.map((slot) => slot.id),
      ),
    );

  return slots.map((slot) => {
    const slotBookings = rows.filter((row) => row.slotId === slot.id);
    return {
      ...slot,
      bookings: slotBookings,
      taken: slotBookings.filter((row) => (ACTIVE as readonly string[]).includes(row.status)).length,
    };
  });
}
