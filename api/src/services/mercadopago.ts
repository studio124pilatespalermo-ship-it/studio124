import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { checkouts, clients, paymentCategories, paymentMethods } from "../db/schema.ts";
import { randomToken } from "../lib/crypto.ts";
import { todayInStudio } from "../lib/dates.ts";
import { AppError, notFound } from "../lib/errors.ts";
import { registerPayment } from "./packs.ts";
import type { SecretStore } from "./secrets.ts";

/** Cobro con Checkout Pro: se crea una preferencia y el webhook confirma el pago. */

const API = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

export interface PreferenceResult {
  readonly checkoutId: string;
  readonly externalReference: string;
  readonly initPoint: string;
}

export async function createPreference(
  db: Database,
  secrets: SecretStore,
  input: { clientId: string; categoryId: string; siteUrl: string; apiUrl: string },
): Promise<PreferenceResult> {
  const accessToken = await secrets.require("MP_ACCESS_TOKEN");

  const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
  if (!client) throw notFound("Cliente");

  const [category] = await db.select().from(paymentCategories).where(eq(paymentCategories.id, input.categoryId)).limit(1);
  if (!category) throw notFound("Categoría de pago");
  if (!category.active || !category.sellOnline) {
    throw new AppError("forbidden", "Esa categoría no está disponible para pago online.");
  }

  const externalReference = `s124-${randomToken(12)}`;
  const [checkout] = await db
    .insert(checkouts)
    .values({ externalReference, clientId: client.id, categoryId: category.id })
    .returning({ id: checkouts.id });
  if (!checkout) throw new AppError("conflict", "No se pudo iniciar el pago.");

  const body = {
    external_reference: externalReference,
    notification_url: `${input.apiUrl}/api/payments/webhook`,
    items: [
      {
        id: category.id,
        title: category.name,
        quantity: 1,
        unit_price: category.priceMinor / 100,
        currency_id: category.currency,
      },
    ],
    payer: { name: client.name, email: client.email ?? undefined },
    back_urls: {
      success: `${input.siteUrl}/cuenta/pago/ok?ref=${externalReference}`,
      pending: `${input.siteUrl}/cuenta/pago/pendiente?ref=${externalReference}`,
      failure: `${input.siteUrl}/cuenta/pago/error?ref=${externalReference}`,
    },
    auto_return: "approved",
  };

  const response = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const preference = (await response.json().catch(() => null)) as { id?: string; init_point?: string } | null;

  if (!response.ok || !preference?.init_point) {
    await db.update(checkouts).set({ status: "failed" }).where(eq(checkouts.id, checkout.id));
    throw new AppError("upstream_error", "Mercado Pago rechazó el inicio del pago. Probá de nuevo.");
  }

  await db
    .update(checkouts)
    .set({ preferenceId: preference.id ?? null, status: "pending" })
    .where(eq(checkouts.id, checkout.id));
  return { checkoutId: checkout.id, externalReference, initPoint: preference.init_point };
}

export type SignatureCheck =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: "missing" | "malformed" | "mismatch" };

/**
 * Mercado Pago manda `x-signature: ts=...,v1=...` y firma este manifiesto exacto,
 * no el cuerpo de la petición:
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * Los tramos sin valor se omiten, y el id alfanumérico va en minúsculas.
 */
export function verifySignature(input: {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): SignatureCheck {
  if (!input.signature) return { valid: false, reason: "missing" };

  const parts = new Map(
    input.signature.split(",").map((piece) => {
      const [key = "", ...rest] = piece.split("=");
      return [key.trim(), rest.join("=").trim()];
    }),
  );
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return { valid: false, reason: "malformed" };

  const id = input.dataId ? (/^[a-zA-Z0-9]+$/.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId) : undefined;
  const manifest = [id ? `id:${id};` : "", input.requestId ? `request-id:${input.requestId};` : "", `ts:${ts};`].join("");

  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(v1);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { valid: false, reason: "mismatch" };
  return { valid: true };
}

interface MpPayment {
  readonly id?: number | string;
  readonly status?: string;
  readonly external_reference?: string;
  readonly transaction_amount?: number;
  readonly payment_method_id?: string;
}

export async function fetchPayment(secrets: SecretStore, paymentId: string): Promise<MpPayment> {
  const accessToken = await secrets.require("MP_ACCESS_TOKEN");
  const response = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new AppError("upstream_error", "No se pudo consultar el pago en Mercado Pago.");
  return (await response.json()) as MpPayment;
}

/**
 * Confirma un pago aprobado: crea el abono con sus créditos. Es idempotente, porque
 * Mercado Pago reintenta el aviso y `packs.mp_payment_id` es único.
 */
export async function confirmPayment(
  db: Database,
  secrets: SecretStore,
  paymentId: string,
): Promise<{ status: "applied" | "ignored" | "duplicate"; packId?: string }> {
  const payment = await fetchPayment(secrets, paymentId);
  if (payment.status !== "approved") return { status: "ignored" };
  if (!payment.external_reference) return { status: "ignored" };

  const [checkout] = await db
    .select()
    .from(checkouts)
    .where(eq(checkouts.externalReference, payment.external_reference))
    .limit(1);
  if (!checkout) return { status: "ignored" };
  if (checkout.packId) return { status: "duplicate", packId: checkout.packId };

  const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.code, "mercado_pago")).limit(1);
  if (!method) throw new AppError("not_configured", 'Falta el medio de pago "mercado_pago".');

  const pack = await registerPayment(db, {
    clientId: checkout.clientId,
    categoryId: checkout.categoryId,
    methodId: method.id,
    startsOn: todayInStudio(),
    amountMinor: payment.transaction_amount !== undefined ? Math.round(payment.transaction_amount * 100) : undefined,
    mpPaymentId: String(payment.id ?? paymentId),
    note: "Pago online con Mercado Pago",
  });

  await db.update(checkouts).set({ packId: pack.id, status: "approved" }).where(eq(checkouts.id, checkout.id));
  return { status: "applied", packId: pack.id };
}
