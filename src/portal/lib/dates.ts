import { INTL_LOCALE, type PortalLocale } from "../i18n";

/**
 * Fechas del portal en el idioma del cliente. Se fija la zona horaria en UTC al formatear
 * "YYYY-MM-DD" para que el día no se corra según dónde esté el visitante: la fecha de la
 * clase es la del estudio, no la de su teléfono.
 */
export function shortDate(isoDate: string, locale: PortalLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function longDate(isoDate: string, locale: PortalLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function money(amountMinor: number, currency: string, locale: PortalLocale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
