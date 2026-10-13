import { describe, expect, it } from "vitest";
import { studio, type StudioData } from "../src/content/studio";
import { getDictionary, interpolate } from "../src/i18n";
import { linkPlaces, resolveFaq, richText } from "../src/lib/content";
import { formatClock, formatDays, formatMoney, formatPhone, formatTime, moneyToSchemaPrice } from "../src/lib/format";
import { buildJsonLd } from "../src/lib/jsonld";
import { displayValue, isPlaceholder } from "../src/lib/placeholders";
import { LOCALES } from "../src/i18n/locales";
import { alternates, googleMapsUrl, instagramHandle, whatsappUrl } from "../src/lib/urls";

describe("placeholders", () => {
  it("reconoce {{DATOS}} pendientes", () => {
    expect(isPlaceholder("{{PRECIO}}")).toBe(true);
    expect(isPlaceholder("Guatemala 4800")).toBe(false);
    expect(displayValue(null, "{{EDAD_MINIMA}}")).toEqual({ text: "{{EDAD_MINIMA}}", pending: true });
  });
});

describe("formato", () => {
  it("muestra el placeholder de precio mientras no hay monto", () => {
    expect(formatMoney({ amountMinor: null, currency: "ARS" }, "es-AR")).toEqual({ text: "{{PRECIO}}", pending: true });
  });

  it("formatea unidades menores con la moneda explícita", () => {
    const price = formatMoney({ amountMinor: 2_500_000, currency: "ARS" }, "en-US");
    expect(price.pending).toBe(false);
    expect(price.text).toContain("ARS");
    expect(price.text).toContain("25,000");
    expect(moneyToSchemaPrice({ amountMinor: 2_500_000, currency: "ARS" })).toBe("25000.00");
  });

  it("nombra rangos de días según el idioma", () => {
    expect(formatDays(["mon", "tue", "wed", "thu", "fri"], getDictionary("es"))).toBe("Lunes a Viernes");
    expect(formatDays(["sat"], getDictionary("en"))).toBe("Saturday");
    expect(formatDays(["sat", "sun"], getDictionary("pt"))).toBe("Sábado, Domingo");
  });

  it("deja visibles las variables sin valor", () => {
    expect(interpolate("{a} y {b}", { a: 1 })).toBe("1 y {b}");
  });
});

describe("urls", () => {
  it("genera hreflang recíprocos y x-default", () => {
    const list = alternates(new URL("https://example.com"));
    expect(list.map((alt) => alt.hreflang)).toEqual(["en", "es", "pt-BR", "x-default"]);
    expect(list.at(-1)?.href).toBe("https://example.com/en/");
  });

  it("arma búsquedas de Google Maps y respeta URLs completas", () => {
    expect(googleMapsUrl("Plaza Armenia, Palermo")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Plaza%20Armenia%2C%20Palermo",
    );
    expect(googleMapsUrl("https://maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
  });

  it("cada lugar que nombra el texto tiene su link de Maps en studio.ts", () => {
    const missing = LOCALES.flatMap((locale) => {
      const dict = getDictionary(locale);
      // El párrafo del medio de "The Experience" es el que nombra los lugares.
      const parts = linkPlaces(dict.experience.body[1] ?? "", dict.experience.places, studio.nearbyPlaces);
      const linked = new Set(parts.filter((part) => part.href !== undefined).map((part) => part.text));
      return Object.values(dict.experience.places)
        .filter((name) => !linked.has(name))
        .map((name) => `${locale}:${name}`);
    });
    expect(missing).toEqual([]);
  });

  it("deja el texto intacto al enlazar los lugares", () => {
    const dict = getDictionary("es");
    const text = dict.experience.body[1] ?? "";
    const parts = linkPlaces(text, dict.experience.places, studio.nearbyPlaces);
    expect(parts.map((part) => part.text).join("")).toBe(text);
  });

  it("no arma un link de WhatsApp con un número pendiente", () => {
    expect(whatsappUrl("{{WHATSAPP_NUMERO}}")).toBe("{{WHATSAPP_NUMERO}}");
    expect(whatsappUrl("+54 9 11 0000-0000")).toBe("https://wa.me/5491100000000");
  });
});

describe("JSON-LD", () => {
  const build = (data: StudioData) =>
    JSON.parse(
      buildJsonLd({
        studio: data,
        pageUrl: "https://example.com/en/",
        siteUrl: "https://example.com/",
        imageUrl: "https://example.com/og-image.jpg",
        logoUrl: "https://example.com/logo.png",
        description: "desc",
        offerName: "Drop-in class",
        bookingUrl: "https://webapp.siguefit.com/",
        faq: resolveFaq(getDictionary("en"), data, "en"),
      }),
    ) as { "@graph": [Record<string, unknown>, { mainEntity: unknown[] }] };

  it("no publica datos pendientes en el LocalBusiness", () => {
    const [business] = build(studio)["@graph"];
    expect(JSON.stringify(business)).not.toMatch(/\{\{/);
    expect(business["@type"]).toBe("ExerciseGym");
  });

  it("incluye la oferta cuando el precio está cargado", () => {
    const [business] = build({ ...studio, dropInPrice: { amountMinor: 2_500_000, currency: "ARS" } })["@graph"];
    expect(business["makesOffer"]).toMatchObject({ price: "25000.00", priceCurrency: "ARS" });
  });

  it("refleja todas las preguntas visibles en el FAQPage", () => {
    const [, faqPage] = build(studio)["@graph"];
    expect(faqPage.mainEntity).toHaveLength(getDictionary("en").faq.items.length);
  });
});

describe("textos con formato", () => {
  it("resuelve *negrita* e _itálica_ sin dejar las marcas", () => {
    const parts = richText("a *b* c _d_ e");
    expect(parts.map((part) => part.text).join("")).toBe("a b c d e");
    expect(parts.find((part) => part.text === "b")?.strong).toBe(true);
    expect(parts.find((part) => part.text === "d")?.italic).toBe(true);
  });
});

describe("teléfono y horas del mockup", () => {
  it("da formato internacional y local a un celular de Buenos Aires", () => {
    expect(formatPhone("5491168309759", "international")).toBe("+54 9 11 6830-9759");
    expect(formatPhone("5491168309759", "local")).toBe("11 6830-9759");
    expect(formatPhone("+1 555 123 4567", "local")).toBe("+15551234567");
  });

  it("escribe las horas como el estudio", () => {
    expect(formatTime("08:00")).toBe("08hs");
    expect(formatTime("16:30")).toBe("16:30hs");
    expect(formatClock("08:00")).toBe("8:00hs");
    expect(formatClock("21:00")).toBe("21:00hs");
  });

  it("saca el usuario de Instagram de la URL del perfil", () => {
    expect(instagramHandle("https://www.instagram.com/studio124.pilates/")).toBe("studio124.pilates");
  });
});
