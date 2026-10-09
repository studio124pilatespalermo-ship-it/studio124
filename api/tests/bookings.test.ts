import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classSlots, clients } from "../src/db/schema.ts";
import { cancelBooking, changeBooking, createBooking, markAttendance } from "../src/services/bookings.ts";
import { packBalance } from "../src/services/credits.ts";
import { registerPayment } from "../src/services/packs.ts";
import { createTestEnv, seedBasics, type TestEnvironment } from "./helpers.ts";

let env: TestEnvironment;

beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.close();
});

/** 15:00 hora de Buenos Aires del 15/10/2026 (UTC−3). */
const CLASS_DATE = "2026-10-15";
const CLASS_TIME = "15:00";
const classStart = new Date("2026-10-15T15:00:00-03:00");
const hoursBefore = (hours: number) => new Date(classStart.getTime() - hours * 3_600_000);

async function scenario(options: { capacity?: number } = {}) {
  const basics = await seedBasics(env.db);
  const [client] = await env.db.insert(clients).values({ name: "Ana" }).returning();
  const [slot] = await env.db
    .insert(classSlots)
    .values({ date: CLASS_DATE, startTime: CLASS_TIME, durationMin: 55, capacity: options.capacity ?? 6 })
    .returning();
  const pack = await registerPayment(env.db, {
    clientId: client!.id,
    categoryId: basics.category.id,
    methodId: basics.method.id,
    startsOn: "2026-10-01",
    endsOn: "2026-10-31",
  });
  return { basics, client: client!, slot: slot!, pack };
}

const staff = { kind: "staff", actor: null } as const;

describe("reservas", () => {
  it("reservar consume un crédito del abono vigente", async () => {
    const { client, slot, pack } = await scenario();
    await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(3);
  });

  it("no permite dos reservas del mismo cliente en el mismo turno", async () => {
    const { client, slot } = await scenario();
    await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    await expect(createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff })).rejects.toThrow(/ya tiene lugar/i);
  });

  it("respeta el cupo del turno", async () => {
    const { basics, slot } = await scenario({ capacity: 1 });
    const [first] = await env.db.insert(clients).values({ name: "Bea" }).returning();
    const [second] = await env.db.insert(clients).values({ name: "Caro" }).returning();
    for (const client of [first!, second!]) {
      await registerPayment(env.db, {
        clientId: client.id,
        categoryId: basics.category.id,
        methodId: basics.method.id,
        startsOn: "2026-10-01",
        endsOn: "2026-10-31",
      });
    }
    await createBooking(env.db, { clientId: first!.id, slotId: slot.id, by: staff });
    await expect(createBooking(env.db, { clientId: second!.id, slotId: slot.id, by: staff })).rejects.toThrow(/completo/i);
  });

  it("sin abono vigente no se puede reservar", async () => {
    const { slot } = await scenario();
    const [sinAbono] = await env.db.insert(clients).values({ name: "Sin abono" }).returning();
    await expect(createBooking(env.db, { clientId: sinAbono!.id, slotId: slot.id, by: staff })).rejects.toThrow(/abono vigente/i);
  });
});

describe("cancelar", () => {
  it("a tiempo devuelve la clase al abono", async () => {
    const { client, slot, pack } = await scenario();
    const booking = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    const result = await cancelBooking(env.db, {
      bookingId: booking.id,
      by: { kind: "client", clientId: client.id },
      now: hoursBefore(5),
    });
    expect(result.refunded).toBe(true);
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(4);
  });

  it("el cliente no puede cancelar fuera de plazo", async () => {
    const { client, slot, pack } = await scenario();
    const booking = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    await expect(
      cancelBooking(env.db, { bookingId: booking.id, by: { kind: "client", clientId: client.id }, now: hoursBefore(1) }),
    ).rejects.toThrow(/plazo/i);
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(3);
  });

  it("el panel puede cancelar fuera de plazo, y la clase se pierde salvo que se devuelva a mano", async () => {
    const { client, slot, pack } = await scenario();
    const booking = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    const lost = await cancelBooking(env.db, { bookingId: booking.id, by: staff, now: hoursBefore(1) });
    expect(lost.refunded).toBe(false);
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(3);

    const second = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    const forced = await cancelBooking(env.db, {
      bookingId: second.id,
      by: staff,
      now: hoursBefore(1),
      refundAnyway: true,
      note: "Aviso por WhatsApp",
    });
    expect(forced.refunded).toBe(true);
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(3);
  });

  it("una reserva ya cerrada no se cancela dos veces", async () => {
    const { client, slot } = await scenario();
    const booking = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    await cancelBooking(env.db, { bookingId: booking.id, by: staff, now: hoursBefore(5) });
    await expect(cancelBooking(env.db, { bookingId: booking.id, by: staff, now: hoursBefore(5) })).rejects.toThrow(/cerrada/i);
  });
});

describe("cambiar y asistencia", () => {
  it("cambiar de turno no gasta un crédito extra y deja la traza", async () => {
    const { client, slot, pack } = await scenario();
    const [other] = await env.db
      .insert(classSlots)
      .values({ date: CLASS_DATE, startTime: "18:00", durationMin: 55, capacity: 6 })
      .returning();
    const booking = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    const moved = await changeBooking(env.db, { bookingId: booking.id, toSlotId: other!.id, by: staff, now: hoursBefore(5) });

    expect((await packBalance(env.db, pack.id))?.remaining).toBe(3);
    const [moved_slot] = await env.db.select().from(classSlots).where(eq(classSlots.id, other!.id));
    expect(moved_slot?.startTime).toBe("18:00");
    expect(moved.id).not.toBe(booking.id);
  });

  it("ausente mantiene la clase consumida", async () => {
    const { client, slot, pack } = await scenario();
    const booking = await createBooking(env.db, { clientId: client.id, slotId: slot.id, by: staff });
    await markAttendance(env.db, { bookingId: booking.id, status: "absent" });
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(3);
  });
});

