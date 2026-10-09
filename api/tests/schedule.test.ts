import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classSlots, holidays } from "../src/db/schema.ts";
import { generateMonth, previewMonth } from "../src/services/schedule.ts";
import { createTestEnv, seedTemplate, type TestEnvironment } from "./helpers.ts";
import { eq } from "drizzle-orm";

let env: TestEnvironment;

beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.close();
});

/** Octubre de 2026: los jueves caen 1, 8, 15, 22 y 29. */
const OCTOBER = { year: 2026, month: 10 } as const;

describe("generar el mes desde la agenda modelo", () => {
  it("crea un turno por cada día de la semana correspondiente", async () => {
    await seedTemplate(env.db, { weekday: 4, startTime: "15:00" });
    const result = await generateMonth(env.db, OCTOBER);
    expect(result.created).toBe(5);

    const rows = await env.db.select().from(classSlots);
    expect(rows.map((row) => row.date).sort()).toEqual([
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
    ]);
  });

  it("repetirla no duplica turnos ni pisa los cambios ya hechos", async () => {
    const template = await seedTemplate(env.db, { weekday: 4, startTime: "15:00" });
    await generateMonth(env.db, OCTOBER);

    // La administradora cambia un turno a mano: otro cupo y cancelado.
    const [first] = await env.db.select().from(classSlots).where(eq(classSlots.date, "2026-10-08"));
    await env.db.update(classSlots).set({ capacity: 2, status: "cancelled" }).where(eq(classSlots.id, first!.id));

    const second = await generateMonth(env.db, OCTOBER);
    expect(second.created).toBe(0);

    const [after] = await env.db.select().from(classSlots).where(eq(classSlots.id, first!.id));
    expect(after?.capacity).toBe(2);
    expect(after?.status).toBe("cancelled");
    expect(await env.db.select().from(classSlots)).toHaveLength(5);
    expect(template.id).toBeTruthy();
  });

  it("saltea los feriados y los informa", async () => {
    await seedTemplate(env.db, { weekday: 4, startTime: "15:00" });
    await env.db.insert(holidays).values({ date: "2026-10-15", name: "Feriado de prueba" });

    const preview = await previewMonth(env.db, OCTOBER);
    expect(preview.toCreate).toHaveLength(4);
    expect(preview.skippedHolidays).toEqual(["2026-10-15"]);

    const result = await generateMonth(env.db, OCTOBER);
    expect(result.created).toBe(4);
    const dates = (await env.db.select().from(classSlots)).map((row) => row.date);
    expect(dates).not.toContain("2026-10-15");
  });

  it("la vista previa no escribe nada", async () => {
    await seedTemplate(env.db, { weekday: 4, startTime: "15:00" });
    const preview = await previewMonth(env.db, OCTOBER);
    expect(preview.toCreate).toHaveLength(5);
    expect(await env.db.select().from(classSlots)).toHaveLength(0);
  });

  it("ignora los turnos desactivados de la agenda modelo", async () => {
    const template = await seedTemplate(env.db, { weekday: 4, startTime: "15:00" });
    await seedTemplate(env.db, { weekday: 5, startTime: "10:00" });
    await env.db.update(classSlots).set({ capacity: 6 }).where(eq(classSlots.templateSlotId, template.id));

    const { templateSlots } = await import("../src/db/schema.ts");
    await env.db.update(templateSlots).set({ active: false }).where(eq(templateSlots.id, template.id));

    const result = await generateMonth(env.db, OCTOBER);
    // Sólo quedan los viernes: 2, 9, 16, 23 y 30.
    expect(result.created).toBe(5);
    const dates = (await env.db.select().from(classSlots)).map((row) => row.date).sort();
    expect(dates[0]).toBe("2026-10-02");
  });
});
