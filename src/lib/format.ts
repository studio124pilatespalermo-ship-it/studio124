import type { DayKey, Money, TimeValue } from "../content/studio";
import { interpolate, type Dictionary } from "../i18n";
import { formatAmount } from "./money";
import { displayValue, isPlaceholder, type DisplayValue } from "./placeholders";

export const PRICE_PLACEHOLDER = "{{PRECIO}}";

/** Precio en la moneda configurada, con el formato del idioma de la página. */
export function formatMoney(money: Money, intlLocale: string): DisplayValue {
  if (money.amountMinor === null) return displayValue(null, PRICE_PLACEHOLDER);
  return { text: formatAmount(money.amountMinor, money.currency, intlLocale), pending: false };
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

/**
 * Hora como la escribe el estudio en el mockup: "08:00" → "08hs", "16:30" → "16:30hs".
 * Un horario pendiente se devuelve tal cual, para que se vea resaltado.
 */
export function formatTime(time: TimeValue): string {
  if (isPlaceholder(time)) return time;
  return time.endsWith(":00") ? `${time.slice(0, time.length - 3)}hs` : `${time}hs`;
}

/**
 * Hora del horario de atención, como el mockup del pie: "08:00" → "8:00hs".
 * Un horario pendiente se devuelve tal cual.
 */
export function formatClock(time: TimeValue): string {
  if (isPlaceholder(time)) return time;
  return `${time.replace(/^0/, "")}hs`;
}

/**
 * Teléfono a partir del número internacional en dígitos (5491168309759).
 * - `international`: "+54 9 11 6830-9759", para quien escribe desde otro país.
 * - `local`: "11 6830-9759", como lo muestra el pie del mockup.
 * Sólo da formato a celulares de Buenos Aires (54 9 11); cualquier otro va con "+" y los dígitos.
 */
export function formatPhone(number: string, style: "international" | "local"): string {
  if (isPlaceholder(number)) return number;
  const digits = number.replace(/\D/g, "");
  const match = /^549(11)(\d{4})(\d{4})$/.exec(digits);
  if (!match) return `+${digits}`;
  const [, area, first, last] = match;
  const local = `${area} ${first}-${last}`;
  return style === "local" ? local : `+54 9 ${local}`;
}
