import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import {
  bookings,
  classSlots,
  clients,
  fixedAssignments,
  packs,
  paymentCategories,
  paymentMethods,
  templateSlots,
} from "../db/schema.ts";
import { addDays, type IsoDate } from "../lib/dates.ts";
import { AppError, notFound } from "../lib/errors.ts";
import { addMovement, packBalance, type Actor } from "./credits.ts";

/**
 * Registrar un pago crea el abono y carga sus créditos. NO genera turnos solos:
 * la administradora usa después "Cargar turnos", revisa la vista previa y confirma.
 * Menos automatismo, menos sorpresas.
 */

export interface RegisterPaymentInput {
  readonly clientId: string;
  readonly categoryId: string;
  readonly methodId: string;
  readonly startsOn: IsoDate;
  /** Si falta, se calcula con la vigencia de la categoría. */
  readonly endsOn?: IsoDate | undefined;
  readonly amountMinor?: number | undefined;
  readonly classes?: number | undefined;
  readonly note?: string | undefined;
  readonly mpPaymentId?: string | undefined;
  readonly actor?: Actor;
}

/** Carga las referencias del pago y valida que existan. */
async function resolveRefs(db: Database, input: RegisterPaymentInput) {
  const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
  if (!client) throw notFound("Cliente");
  const [category] = await db
    .select()
    .from(paymentCategories)
    .where(eq(paymentCategories.id, input.categoryId))
    .limit(1);
  if (!category) throw notFound("Categoría de pago");
  const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, input.methodId)).limit(1);
  if (!method) throw notFound("Medio de pago");
  return { category, method };
}

export async function registerPayment(db: Database, input: RegisterPaymentInput): Promise<{ id: string }> {
  const { category, method } = await resolveRefs(db, input);

  const classesTotal = input.classes ?? category.classes;
  if (classesTotal < 1) throw new AppError("bad_request", "El abono tiene que incluir al menos una clase.");

  const endsOn = input.endsOn ?? addDays(input.startsOn, category.validityDays - 1);
  if (endsOn < input.startsOn) throw new AppError("bad_request", "El vencimiento no puede ser anterior al inicio.");

  const [created] = await db
    .insert(packs)
    .values({
      clientId: input.clientId,
      categoryId: category.id,
      methodId: method.id,
      amountMinor: input.amountMinor ?? category.priceMinor,
      currency: category.currency,
      classesTotal,
      startsOn: input.startsOn,
      endsOn,
      status: "active",
      mpPaymentId: input.mpPaymentId ?? null,
      note: input.note ?? null,
      createdBy: input.actor?.type === "user" ? input.actor.id : null,
    })
    .returning({ id: packs.id });
  if (!created) throw new AppError("conflict", "No se pudo registrar el pago.");

  await addMovement(db, {
    packId: created.id,
    clientId: input.clientId,
    delta: classesTotal,
    reason: "loaded",
    note: `${category.name} · ${classesTotal} clase(s)`,
    actor: input.actor ?? null,
  });
  return created;
}

export interface SlotCandidate {
  readonly slotId: string;
  readonly date: IsoDate;
  readonly startTime: string;
  readonly available: boolean;
  readonly reason?: string;
}

/**
 * Vista previa de "Cargar turnos": propone los turnos según los días fijos del cliente,
 * dentro de la vigencia del abono y hasta agotar sus créditos. La administradora decide.
 */
export async function suggestSlots(db: Database, packId: string): Promise<SlotCandidate[]> {
  const balance = await packBalance(db, packId);
  if (!balance) throw notFound("Abono");
  if (balance.remaining <= 0) return [];

  const fixed = await db
    .select({ templateSlotId: fixedAssignments.templateSlotId })
    .from(fixedAssignments)
    .where(eq(fixedAssignments.clientId, balance.clientId));
  if (fixed.length === 0) return [];

  const slots = await db
    .select()
    .from(classSlots)
    .where(
      and(
        inArray(
          classSlots.templateSlotId,
          fixed.map((row) => row.templateSlotId),
        ),
        eq(classSlots.status, "scheduled"),
        sql`${classSlots.date} >= ${balance.startsOn}`,
        sql`${classSlots.date} <= ${balance.endsOn}`,
      ),
    )
    .orderBy(classSlots.date, classSlots.startTime)
    .limit(balance.remaining * 3);

  if (slots.length === 0) return [];
  const slotIds = slots.map((slot) => slot.id);

  const taken = await db
    .select({ slotId: bookings.classSlotId, clientId: bookings.clientId, status: bookings.status })
    .from(bookings)
    .where(inArray(bookings.classSlotId, slotIds));

  const candidates: SlotCandidate[] = [];
  let remaining = balance.remaining;
  for (const slot of slots) {
    if (remaining === 0) break;
    const onSlot = taken.filter((row) => row.slotId === slot.id && !row.status.startsWith("cancelled"));
    if (onSlot.some((row) => row.clientId === balance.clientId)) {
      candidates.push({ slotId: slot.id, date: slot.date, startTime: slot.startTime, available: false, reason: "Ya reservado" });
      continue;
    }
    if (onSlot.length >= slot.capacity) {
      candidates.push({ slotId: slot.id, date: slot.date, startTime: slot.startTime, available: false, reason: "Completo" });
      continue;
    }
    candidates.push({ slotId: slot.id, date: slot.date, startTime: slot.startTime, available: true });
    remaining -= 1;
  }
  return candidates;
}

export async function listPacks(db: Database, filters: { clientId?: string; status?: "active" | "expired" } = {}) {
  const conditions = [];
  if (filters.clientId) conditions.push(eq(packs.clientId, filters.clientId));
  if (filters.status) conditions.push(eq(packs.status, filters.status));

  const rows = await db
    .select({
      id: packs.id,
      clientId: packs.clientId,
      clientName: clients.name,
      categoryName: paymentCategories.name,
      methodName: paymentMethods.name,
      amountMinor: packs.amountMinor,
      currency: packs.currency,
      classesTotal: packs.classesTotal,
      startsOn: packs.startsOn,
      endsOn: packs.endsOn,
      status: packs.status,
      note: packs.note,
      createdAt: packs.createdAt,
    })
    .from(packs)
    .innerJoin(clients, eq(clients.id, packs.clientId))
    .innerJoin(paymentCategories, eq(paymentCategories.id, packs.categoryId))
    .innerJoin(paymentMethods, eq(paymentMethods.id, packs.methodId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(packs.createdAt));
  return rows;
}

/** Turnos fijos del cliente sobre la agenda modelo. */
export async function clientFixedSlots(db: Database, clientId: string) {
  return db
    .select({
      id: fixedAssignments.id,
      templateSlotId: templateSlots.id,
      weekday: templateSlots.weekday,
      startTime: templateSlots.startTime,
    })
    .from(fixedAssignments)
    .innerJoin(templateSlots, eq(templateSlots.id, fixedAssignments.templateSlotId))
    .where(eq(fixedAssignments.clientId, clientId))
    .orderBy(templateSlots.weekday, templateSlots.startTime);
}
