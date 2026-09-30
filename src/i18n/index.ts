import en from "./en.json";
import es from "./es.json";
import pt from "./pt.json";
import type { Locale } from "./locales";

/** El inglés define la forma del diccionario: si a pt o es les falta una clave, el typecheck falla. */
export type Dictionary = typeof en;

const dictionaries: Readonly<Record<Locale, Dictionary>> = { en, pt, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type TemplateVars = Readonly<Record<string, string | number>>;

/**
 * Reemplaza `{clave}` por su valor. Una clave sin valor queda intacta para que el
 * error se vea en pantalla en lugar de desaparecer en silencio.
 */
export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}
