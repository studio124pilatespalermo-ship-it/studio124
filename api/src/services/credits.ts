import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { creditMovements, packs } from "../db/schema.ts";
import { todayInStudio, type IsoDate } from "../lib/dates.ts";
import { AppError } from "../lib/errors.ts";

/**
 * El saldo de un pack NO se guarda como número: es la suma de sus movimientos.
 *
 * Así cada clase cargada, usada, devuelta o ajustada queda explicada, con quién la hizo y
 * cuándo. Si un saldo parece mal, se lee el libro en vez de adivinar.
 */
export type Actor = { readonly type: "user" | "client"; readonly id: string } | null;

export interface PackBalance {
  readonly packId: string;
  readonly clientId: string;
  readonly categoryId: string;
  readonly classesTotal: number;
  readonly used: number;
  readonly remaining: number;
  readonly startsOn: IsoDate;
  readonly endsOn: IsoDate;
  readonly status: "pending" | "active" | "expired" | "cancelled";
}

export async function packBalance(db: Database, packId: string): Promise<PackBalance | null> {
  const [row] = await db
    .select({
      packId: packs.id,
      clientId: packs.clientId,
      categoryId: packs.categoryId,
      classesTotal: packs.classesTotal,
      startsOn: packs.startsOn,
      endsOn: packs.endsOn,
      status: packs.status,
      remaining: sql<number>`coalesce(sum(${creditMovements.delta}), 0)::int`,
    })
    .from(packs)
    .leftJoin(creditMovements, eq(creditMovements.packId, packs.id))
    .where(eq(packs.id, packId))
    .groupBy(packs.id)
    .limit(1);
  if (!row) return null;
  return { ...row, used: row.classesTotal - row.remaining };
}

export async function clientBalances(db: Database, clientId: string): Promise<PackBalance[]> {
  const rows = await db
    .select({
      packId: packs.id,
      clientId: packs.clientId,
      categoryId: packs.categoryId,
      classesTotal: packs.classesTotal,
      startsOn: packs.startsOn,
      endsOn: packs.endsOn,
      status: packs.status,
      remaining: sql<number>`coalesce(sum(${creditMovements.delta}), 0)::int`,
    })
    .from(packs)
    .leftJoin(creditMovements, eq(creditMovements.packId, packs.id))
    .where(eq(packs.clientId, clientId))
    .groupBy(packs.id)
    .orderBy(desc(packs.startsOn));
  return rows.map((row) => ({ ...row, used: row.classesTotal - row.remaining }));
}

/**
 * Pack con el que se cubre una clase en `date`: activo, vigente y con saldo.
 * Se elige el que vence primero, para que no caduquen créditos por usar otro.
 */
export async function packForDate(db: Database, clientId: string, date: IsoDate): Promise<PackBalance | null> {
  const balances = await clientBalances(db, clientId);
  const usable = balances
    .filter((pack) => pack.status === "active" && pack.remaining > 0 && pack.startsOn <= date && date <= pack.endsOn)
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
  return usable[0] ?? null;
}

export interface MovementInput {
  readonly packId: string;
  readonly clientId: string;
  readonly delta: number;
  readonly reason: "loaded" | "booked" | "refunded" | "adjustment" | "expired";
  readonly bookingId?: string | undefined;
  readonly note?: string | undefined;
  readonly actor?: Actor;
}

export async function addMovement(db: Database, input: MovementInput): Promise<void> {
  await db.insert(creditMovements).values({
    packId: input.packId,
    clientId: input.clientId,
    delta: input.delta,
    reason: input.reason,
    bookingId: input.bookingId ?? null,
    note: input.note ?? null,
    actorType: input.actor?.type ?? null,
    actorId: input.actor?.id ?? null,
  });
}

/** Consume un crédito validando vigencia y saldo. Se llama dentro de la transacción de la reserva. */
export async function consumeCredit(
  db: Database,
  options: { packId: string; clientId: string; date: IsoDate; bookingId?: string | undefined; actor?: Actor },
): Promise<void> {
  const balance = await packBalance(db, options.packId);
  if (!balance) throw new AppError("not_found", "Abono no encontrado.");
  if (balance.status !== "active") throw new AppError("pack_expired", "El abono no está activo.");
  if (options.date < balance.startsOn || options.date > balance.endsOn) {
    throw new AppError("pack_expired", "La fecha queda fuera de la vigencia del abono.");
  }
  if (balance.remaining <= 0) throw new AppError("no_credits", "El abono no tiene clases disponibles.");
  await addMovement(db, {
    packId: options.packId,
    clientId: options.clientId,
    delta: -1,
    reason: "booked",
    bookingId: options.bookingId,
    actor: options.actor ?? null,
  });
}

export async function refundCredit(
  db: Database,
  options: { packId: string; clientId: string; bookingId?: string | undefined; note?: string | undefined; actor?: Actor },
): Promise<void> {
  await addMovement(db, {
    packId: options.packId,
    clientId: options.clientId,
    delta: 1,
    reason: "refunded",
    bookingId: options.bookingId,
    note: options.note,
    actor: options.actor ?? null,
  });
}

/** Ajuste manual desde el panel. Siempre con motivo: es lo que explica un saldo distinto. */
export async function adjustCredits(
  db: Database,
  options: { packId: string; delta: number; note: string; actor?: Actor },
): Promise<PackBalance> {
  if (options.delta === 0) throw new AppError("bad_request", "El ajuste no puede ser cero.");
  if (!options.note.trim()) throw new AppError("bad_request", "El ajuste necesita un motivo.");
  const balance = await packBalance(db, options.packId);
  if (!balance) throw new AppError("not_found", "Abono no encontrado.");
  if (balance.remaining + options.delta < 0) {
    throw new AppError("conflict", "El ajuste dejaría el abono con saldo negativo.");
  }
  await addMovement(db, {
    packId: options.packId,
    clientId: balance.clientId,
    delta: options.delta,
    reason: "adjustment",
    note: options.note.trim(),
    actor: options.actor ?? null,
  });
  return (await packBalance(db, options.packId)) as PackBalance;
}

export async function listMovements(db: Database, packIds: string[]) {
  if (packIds.length === 0) return [];
  return db
    .select()
    .from(creditMovements)
    .where(inArray(creditMovements.packId, packIds))
    .orderBy(desc(creditMovements.createdAt));
}

/**
 * Marca como vencidos los packs cuya vigencia terminó. Devuelve los afectados para el aviso
 * por email. Idempotente: un pack ya vencido no se vuelve a marcar.
 */
export async function expirePacks(db: Database, today: IsoDate = todayInStudio()) {
  const expired = await db
    .update(packs)
    .set({ status: "expired" })
    .where(and(eq(packs.status, "active"), sql`${packs.endsOn} < ${today}`))
    .returning({ id: packs.id, clientId: packs.clientId, endsOn: packs.endsOn });
  for (const pack of expired) {
    const balance = await packBalance(db, pack.id);
    if (balance && balance.remaining > 0) {
      await addMovement(db, {
        packId: pack.id,
        clientId: pack.clientId,
        delta: -balance.remaining,
        reason: "expired",
        note: `Vencido el ${pack.endsOn}.`,
      });
    }
  }
  return expired;
}
