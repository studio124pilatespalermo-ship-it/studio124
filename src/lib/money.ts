/**
 * Formato de precios, sin dependencias: lo usan el build y el script de precios de la
 * landing en el navegador (importar lib/format.ts ahí sumaría los tres diccionarios).
 */
export type Currency = "ARS" | "USD";

/** "ARS 40,000" / "ARS 40.000": monto en unidades menores, con el código de la moneda. */
export function formatAmount(amountMinor: number, currency: Currency, intlLocale: string): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
