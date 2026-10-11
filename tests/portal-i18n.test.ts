import { describe, expect, it } from "vitest";
import en from "../src/portal/i18n/en.json";
import es from "../src/portal/i18n/es.json";
import pt from "../src/portal/i18n/pt.json";
import { detectLocale, fill, isPortalLocale, PORTAL_LOCALES } from "../src/portal/i18n";

type Leaf = readonly [path: string, value: string];

function leaves(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  throw new Error(`Valor inesperado en ${path}: ${String(value)}`);
}

const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const reference = leaves(es);

describe.each([
  ["en", en],
  ["pt", pt],
  ["es", es],
])("diccionario del portal %s", (_locale, dictionary) => {
  const entries = leaves(dictionary);

  it("tiene exactamente las mismas claves que el español", () => {
    expect(entries.map(([path]) => path)).toEqual(reference.map(([path]) => path));
  });

  it("no tiene textos vacíos", () => {
    expect(entries.filter(([, value]) => value.trim() === "")).toEqual([]);
  });

  it("usa las mismas variables {clave} que el español", () => {
    const mismatches = entries.filter(([, value], index) => {
      const ref = reference[index];
      return ref !== undefined && tokens(value).join() !== tokens(ref[1]).join();
    });
    expect(mismatches).toEqual([]);
  });
});

describe("idioma del portal", () => {
  it("toma el primero que habla el portal, en el orden del navegador", () => {
    expect(detectLocale(["pt-BR", "en-US"])).toBe("pt");
    expect(detectLocale(["en-GB", "es-AR"])).toBe("en");
    // Si el navegador no pide ninguno de los tres, queda el del estudio.
    expect(detectLocale(["de-DE", "fr-FR"])).toBe("es");
    expect(detectLocale([])).toBe("es");
  });

  it("reconoce sólo los tres idiomas del portal", () => {
    for (const locale of PORTAL_LOCALES) expect(isPortalLocale(locale)).toBe(true);
    expect(isPortalLocale("de")).toBe(false);
    expect(isPortalLocale(undefined)).toBe(false);
  });

  it("deja a la vista una variable sin valor en lugar de borrarla", () => {
    expect(fill("{a} de {b}", { a: 2 })).toBe("2 de {b}");
    expect(fill("{remaining} de {total}", { remaining: 1, total: 4 })).toBe("1 de 4");
  });
});
