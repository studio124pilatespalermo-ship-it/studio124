import type { StudioData } from "../content/studio";
import { interpolate, type Dictionary, type TemplateVars } from "../i18n";
import { LOCALE_META, type Locale } from "../i18n/locales";
import { googleMapsUrl } from "./urls";

/**
 * Valores de studio.ts que los textos traducidos insertan con `{clave}`.
 * Un dato en `null` se reemplaza por su placeholder visible.
 */
export function templateVars(studio: StudioData, locale: Locale): TemplateVars {
  return {
    max: studio.maxPeoplePerClass,
    minutes: studio.classDurationMinutes ?? "{{DURACION}}",
    hours: studio.rescheduleNoticeHours ?? "{{HORAS_AVISO}}",
    age: studio.minimumAge ?? "{{EDAD_MINIMA}}",
    packs: packList(studio.packSizes, locale),
    weeks: studio.packValidityWeeks ?? "{{SEMANAS_PACK}}",
  };
}

/** "4, 8, 12 y 16" / "4, 8, 12 and 16" / "4, 8, 12 e 16", según el idioma. */
function packList(sizes: readonly number[], locale: Locale): string {
  const format = new Intl.ListFormat(LOCALE_META[locale].intl, { type: "conjunction" });
  return format.format(sizes.map(String));
}

export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/** Preguntas frecuentes ya resueltas: las usan el acordeón y el JSON-LD, así ambos dicen lo mismo. */
export function resolveFaq(dict: Dictionary, studio: StudioData, locale: Locale): readonly FaqEntry[] {
  const vars = templateVars(studio, locale);
  return dict.faq.items.map((item) => ({
    question: interpolate(item.question, vars),
    answer: interpolate(item.answer, vars),
  }));
}

/** Un trozo de párrafo: texto suelto, el nombre de un lugar con su link, o texto destacado. */
export interface TextPart {
  readonly text: string;
  readonly href?: string;
  readonly strong?: boolean;
  readonly italic?: boolean;
}

/**
 * Parte un párrafo en trozos, enlazando a Google Maps los lugares que nombra. El texto del
 * cliente se escribe una sola vez (en i18n, sin marcas dentro de la traducción): los nombres
 * salen de `experience.places` del idioma y los links de `studio.nearbyPlaces`.
 */
export function linkPlaces(
  text: string,
  names: Readonly<Record<string, string>>,
  queries: Readonly<Record<string, string>>,
): readonly TextPart[] {
  // De más largo a más corto: "El Preferido de Palermo" gana sobre un eventual "Palermo".
  const hits = Object.entries(names)
    .map(([id, name]) => ({ id, name, at: text.indexOf(name) }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at || b.name.length - a.name.length);

  const parts: TextPart[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.at < cursor) continue; // Ya quedó dentro de un nombre más largo.
    if (hit.at > cursor) parts.push({ text: text.slice(cursor, hit.at) });
    const query = queries[hit.id];
    parts.push(query === undefined ? { text: hit.name } : { text: hit.name, href: googleMapsUrl(query) });
    cursor = hit.at + hit.name.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

/**
 * Párrafo listo para pintar: enlaza los lugares y resuelve las dos marcas que admiten los
 * textos de i18n, `*negrita*` y `_itálica_`. No hay otra: el resto del texto es literal.
 */
export function richText(
  text: string,
  names: Readonly<Record<string, string>> = {},
  queries: Readonly<Record<string, string>> = {},
): readonly TextPart[] {
  return text
    .split(/(\*[^*]+\*|_[^_]+_)/)
    .flatMap((chunk) => {
      const strong = /^\*[^*]+\*$/.test(chunk);
      const italic = /^_[^_]+_$/.test(chunk);
      const inner = strong || italic ? chunk.slice(1, -1) : chunk;
      return linkPlaces(inner, names, queries).map((part) => {
        if (strong) return { ...part, strong: true };
        if (italic) return { ...part, italic: true };
        return part;
      });
    })
    .filter((part) => part.text !== "");
}
