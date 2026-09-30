import type { DayKey, Money } from "../content/studio";
import { interpolate, type Dictionary } from "../i18n";
import { displayValue, type DisplayValue } from "./placeholders";

export const PRICE_PLACEHOLDER = "{{PRECIO}}";

/** Precio en la moneda configurada, con el formato del idioma de la página. */
export function formatMoney(money: Money, intlLocale: string): DisplayValue {
  if (money.amountMinor === null) return displayValue(null, PRICE_PLACEHOLDER);
  const amount = money.amountMinor / 100;
  const text = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: money.currency,
    currencyDisplay: "code",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
  return { text, pending: false };
}

/** Precio sin formato para el JSON-LD (schema.org espera "12000.00"). */
export function moneyToSchemaPrice(money: Money): string | undefined {
  return money.amountMinor === null ? undefined : (money.amountMinor / 100).toFixed(2);
}

/**
 * Nombre de un grupo de días: "Lunes a viernes" para días consecutivos, o la lista
 * separada por comas. Asume que `days` viene en orden de semana.
 */
export function formatDays(days: readonly DayKey[], dict: Dictionary): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return "";
  if (days.length === 1) return dict.days[first];
  if (days.length > 2) {
    return interpolate(dict.days.range, { from: dict.days[first], to: dict.days[last] });
  }
  return days.map((day) => dict.days[day]).join(", ");
}
