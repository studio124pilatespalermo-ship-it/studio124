import { DEFAULT_LOCALE, LOCALE_META, LOCALES, type Locale } from "../i18n/locales";
import { isPlaceholder } from "./placeholders";

export function localePath(locale: Locale): string {
  return `/${locale}/`;
}

export function absoluteUrl(path: string, site: URL): string {
  return new URL(path, site).toString();
}

export interface Alternate {
  readonly hreflang: string;
  readonly href: string;
}

/** hreflang recíprocos entre los tres idiomas, más x-default hacia el idioma de respaldo. */
export function alternates(site: URL): readonly Alternate[] {
  const perLocale = LOCALES.map((locale) => ({
    hreflang: LOCALE_META[locale].hreflang,
    href: absoluteUrl(localePath(locale), site),
  }));
  return [...perLocale, { hreflang: "x-default", href: absoluteUrl(localePath(DEFAULT_LOCALE), site) }];
}

/**
 * Link a Google Maps: si ya es una URL se usa tal cual; si es texto, se arma una búsqueda
 * con la API oficial de URLs de Maps (abre la app en mobile).
 */
export function googleMapsUrl(queryOrUrl: string): string {
  if (/^https?:\/\//.test(queryOrUrl)) return queryOrUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryOrUrl)}`;
}

/** Link de WhatsApp o placeholder si el número todavía no está cargado. */
export function whatsappUrl(number: string): string {
  return isPlaceholder(number) ? number : `https://wa.me/${number.replace(/\D/g, "")}`;
}
