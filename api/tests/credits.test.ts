import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clients } from "../src/db/schema.ts";
import { adjustCredits, clientBalances, expirePacks, packBalance } from "../src/services/credits.ts";
import { registerPayment } from "../src/services/packs.ts";
import { createTestEnv, seedBasics, type TestEnvironment } from "./helpers.ts";

let env: TestEnvironment;

beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.close();
});

async function newClient(name = "Ana") {
  const [client] = await env.db.insert(clients).values({ name }).returning();
  return client!;
}

describe("libro de créditos", () => {
  it("un pago carga tantos créditos como clases tiene el pack", async () => {
    const basics = await seedBasics(env.db);
    const client = await newClient();
    const pack = await registerPayment(env.db, {
      clientId: client.id,
      categoryId: basics.category.id,
      methodId: basics.method.id,
      startsOn: "2026-10-01",
    });

    const balance = await packBalance(env.db, pack.id);
    expect(balance?.classesTotal).toBe(4);
    expect(balance?.remaining).toBe(4);
    expect(balance?.used).toBe(0);
    // La vigencia se calcula con los días de la categoría (30), inclusive el primer día.
    expect(balance?.endsOn).toBe("2026-10-30");
  });

  it("respeta el vencimiento explícito cuando se indica", async () => {
    const basics = await seedBasics(env.db);
    const client = await newClient();
    const pack = await registerPayment(env.db, {
      clientId: client.id,
      categoryId: basics.category.id,
      methodId: basics.method.id,
      startsOn: "2026-10-01",
      endsOn: "2026-11-15",
    });
    expect((await packBalance(env.db, pack.id))?.endsOn).toBe("2026-11-15");
  });

  it("el ajuste manual exige motivo y no deja saldo negativo", async () => {
    const basics = await seedBasics(env.db);
    const client = await newClient();
    const pack = await registerPayment(env.db, {
      clientId: client.id,
      categoryId: basics.category.id,
      methodId: basics.method.id,
      startsOn: "2026-10-01",
    });

    await expect(adjustCredits(env.db, { packId: pack.id, delta: 1, note: "  " })).rejects.toThrow(/motivo/i);
    await expect(adjustCredits(env.db, { packId: pack.id, delta: -9, note: "error de carga" })).rejects.toThrow(/negativo/i);

    const balance = await adjustCredits(env.db, { packId: pack.id, delta: 2, note: "clase de cortesía" });
    expect(balance.remaining).toBe(6);
  });

  it("al vencer, el pack pierde el saldo restante y queda explicado en el libro", async () => {
    const basics = await seedBasics(env.db);
    const client = await newClient();
    const pack = await registerPayment(env.db, {
      clientId: client.id,
      categoryId: basics.category.id,
      methodId: basics.method.id,
      startsOn: "2026-01-01",
      endsOn: "2026-01-31",
    });

    const expired = await expirePacks(env.db, "2026-03-01");
    expect(expired).toHaveLength(1);

    const balance = await packBalance(env.db, pack.id);
    expect(balance?.status).toBe("expired");
    expect(balance?.remaining).toBe(0);

    // Correrla de nuevo no vuelve a descontar.
    expect(await expirePacks(env.db, "2026-03-02")).toHaveLength(0);
    expect((await packBalance(env.db, pack.id))?.remaining).toBe(0);
  });

  it("lista los abonos del cliente, del más nuevo al más viejo", async () => {
    const basics = await seedBasics(env.db);
    const client = await newClient();
    for (const startsOn of ["2026-08-01", "2026-10-01"]) {
      await registerPayment(env.db, {
        clientId: client.id,
        categoryId: basics.category.id,
        methodId: basics.method.id,
        startsOn,
      });
    }
    const balances = await clientBalances(env.db, client.id);
    expect(balances.map((balance) => balance.startsOn)).toEqual(["2026-10-01", "2026-08-01"]);
  });
});
