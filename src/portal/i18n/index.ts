import { createContext, useContext } from "react";
import en from "./en.json";
import es from "./es.json";
import pt from "./pt.json";

/** El español define la forma del diccionario: si falta una clave en otro idioma, no compila. */
export type PortalDictionary = typeof es;

export const PORTAL_LOCALES = ["es", "en", "pt"] as const;
export type PortalLocale = (typeof PORTAL_LOCALES)[number];

export const LOCALE_LABEL: Record<PortalLocale, string> = { es: "ES", en: "EN", pt: "PT" };
export const LOCALE_NAME: Record<PortalLocale, string> = { es: "Español", en: "English", pt: "Português" };
/** Para Intl: fechas y montos en la variante que usa cada visitante. */
export const INTL_LOCALE: Record<PortalLocale, string> = { es: "es-AR", en: "en-US", pt: "pt-BR" };

const DICTIONARIES: Record<PortalLocale, PortalDictionary> = { es, en: en as PortalDictionary, pt: pt as PortalDictionary };

export function isPortalLocale(value: unknown): value is PortalLocale {
  return typeof value === "string" && (PORTAL_LOCALES as readonly string[]).includes(value);
}

/** Idioma que pide el navegador, si el portal lo habla. */
export function detectLocale(languages: readonly string[] = navigator.languages): PortalLocale {
  for (const language of languages) {
    const code = language.slice(0, 2).toLowerCase();
    if (isPortalLocale(code)) return code;
  }
  return "es";
}

export const PortalLocaleContext = createContext<{
  readonly locale: PortalLocale;
  readonly t: PortalDictionary;
  readonly setLocale: (locale: PortalLocale) => void;
}>({ locale: "es", t: es, setLocale: () => undefined });

export function usePortalLocale() {
  return useContext(PortalLocaleContext);
}

export function dictionaryFor(locale: PortalLocale): PortalDictionary {
  return DICTIONARIES[locale];
}

/** Reemplaza `{clave}`. Una clave sin valor queda a la vista en lugar de desaparecer. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
