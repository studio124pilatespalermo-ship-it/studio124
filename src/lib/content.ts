import type { StudioData } from "../content/studio";
import { interpolate, type Dictionary, type TemplateVars } from "../i18n";
import { googleMapsUrl } from "./urls";

/** Link de Google Maps de un lugar de "Todo está cerca", o `undefined` si no está cargado. */
export function nearbyPlaceMapsUrl(studio: StudioData, id: string): string | undefined {
  const query = studio.nearbyPlaces[id];
  return query === undefined ? undefined : googleMapsUrl(query);
}

/**
 * Valores de studio.ts que los textos traducidos insertan con `{clave}`.
 * Un dato en `null` se reemplaza por su placeholder visible.
 */
export function templateVars(studio: StudioData): TemplateVars {
  return {
    max: studio.maxPeoplePerClass,
    minutes: studio.classDurationMinutes ?? "{{DURACION}}",
    hours: studio.rescheduleNoticeHours ?? "{{HORAS_AVISO}}",
    age: studio.minimumAge ?? "{{EDAD_MINIMA}}",
  };
}

export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/** Preguntas frecuentes ya resueltas: las usan el acordeón y el JSON-LD, así ambos dicen lo mismo. */
export function resolveFaq(dict: Dictionary, studio: StudioData): readonly FaqEntry[] {
  const vars = templateVars(studio);
  return dict.faq.items.map((item) => ({
    question: interpolate(item.question, vars),
    answer: interpolate(item.answer, vars),
  }));
}
