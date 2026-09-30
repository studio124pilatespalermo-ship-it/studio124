import { describe, expect, it } from "vitest";
import { getDictionary } from "../src/i18n";
import { LOCALES } from "../src/i18n/locales";

type Leaf = readonly [path: string, value: string];

function leaves(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  throw new Error(`Valor inesperado en ${path}: ${String(value)}`);
}

const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const reference = leaves(getDictionary("en"));

describe.each(LOCALES)("diccionario %s", (locale) => {
  const entries = leaves(getDictionary(locale));

  it("tiene exactamente las mismas claves que el inglés", () => {
    expect(entries.map(([path]) => path)).toEqual(reference.map(([path]) => path));
  });

  it("no tiene textos vacíos", () => {
    expect(entries.filter(([, value]) => value.trim() === "")).toEqual([]);
  });

  it("usa las mismas variables {clave} que el inglés", () => {
    const mismatches = entries.filter(([, value], index) => {
      const ref = reference[index];
      return ref !== undefined && tokens(value).join() !== tokens(ref[1]).join();
    });
    expect(mismatches).toEqual([]);
  });

  it("no incluye emojis (las marcas se resuelven con diseño)", () => {
    expect(entries.filter(([, value]) => /\p{Extended_Pictographic}/u.test(value))).toEqual([]);
  });
});
