export const LOCALES = ["en", "pt", "es"] as const;

export type Locale = (typeof LOCALES)[number];

/** Idioma de respaldo cuando el navegador no pide ninguno de los soportados. */
export const DEFAULT_LOCALE: Locale = "en";

/** Bandera que acompaña a cada idioma en el selector, según la variante usada en los textos. */
export type FlagCode = "us" | "br" | "ar";

export interface LocaleMeta {
  /** Sigla visible en el selector. */
  readonly label: string;
  readonly flag: FlagCode;
  /** Nombre del idioma en su propio idioma (endónimo), para lectores de pantalla. */
  readonly name: string;
  readonly htmlLang: string;
  readonly hreflang: string;
  readonly ogLocale: string;
  /** Locale para Intl (moneda, números). */
  readonly intl: string;
}

export const LOCALE_META: Readonly<Record<Locale, LocaleMeta>> = {
  en: { label: "EN", flag: "us", name: "English", htmlLang: "en", hreflang: "en", ogLocale: "en_US", intl: "en-US" },
  pt: { label: "PT", flag: "br", name: "Português", htmlLang: "pt-BR", hreflang: "pt-BR", ogLocale: "pt_BR", intl: "pt-BR" },
  es: { label: "ES", flag: "ar", name: "Español", htmlLang: "es-AR", hreflang: "es", ogLocale: "es_AR", intl: "es-AR" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
