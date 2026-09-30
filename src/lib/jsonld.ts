import type { DayKey, OpeningHours, StudioData } from "../content/studio";
import type { FaqEntry } from "./content";
import { moneyToSchemaPrice } from "./format";
import { definedOrUndefined, isPlaceholder } from "./placeholders";

/**
 * Datos estructurados fieles a lo visible: todo dato pendiente ({{...}} o null) se omite
 * del LocalBusiness en lugar de publicarse como si fuera real.
 */
export interface JsonLdInput {
  readonly studio: StudioData;
  readonly pageUrl: string;
  readonly siteUrl: string;
  readonly imageUrl: string;
  readonly logoUrl: string;
  readonly description: string;
  readonly offerName: string;
  readonly bookingUrl: string;
  readonly faq: readonly FaqEntry[];
}

type JsonObject = Record<string, unknown>;

const SCHEMA_DAYS: Readonly<Record<DayKey, string>> = {
  mon: "https://schema.org/Monday",
  tue: "https://schema.org/Tuesday",
  wed: "https://schema.org/Wednesday",
  thu: "https://schema.org/Thursday",
  fri: "https://schema.org/Friday",
  sat: "https://schema.org/Saturday",
  sun: "https://schema.org/Sunday",
};

function withoutEmpty(object: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)),
  );
}

function openingHoursSpec(hours: readonly OpeningHours[]): JsonObject[] {
  return hours
    .filter((entry) => !isPlaceholder(entry.opens) && !isPlaceholder(entry.closes))
    .map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: entry.days.map((day) => SCHEMA_DAYS[day]),
      opens: entry.opens,
      closes: entry.closes,
    }));
}

function offer(input: JsonLdInput): JsonObject | undefined {
  const price = moneyToSchemaPrice(input.studio.dropInPrice);
  if (price === undefined) return undefined;
  return {
    "@type": "Offer",
    name: input.offerName,
    price,
    priceCurrency: input.studio.dropInPrice.currency,
    url: input.bookingUrl,
  };
}

function localBusiness(input: JsonLdInput): JsonObject {
  const { studio } = input;
  const address = withoutEmpty({
    "@type": "PostalAddress",
    streetAddress: definedOrUndefined(studio.address.street),
    addressLocality: studio.address.city,
    postalCode: definedOrUndefined(studio.address.postalCode),
    addressCountry: studio.address.countryCode,
  });
  const sameAs = [studio.links.instagram, studio.links.facebook].filter((url) => !isPlaceholder(url));
  const geo = studio.geo ? { "@type": "GeoCoordinates", ...studio.geo } : undefined;

  return withoutEmpty({
    "@type": "ExerciseGym",
    "@id": `${input.siteUrl}#studio`,
    name: studio.name,
    description: input.description,
    url: input.pageUrl,
    image: input.imageUrl,
    logo: input.logoUrl,
    address,
    geo,
    hasMap: definedOrUndefined(studio.links.googleMaps),
    email: definedOrUndefined(studio.email),
    sameAs,
    openingHoursSpecification: openingHoursSpec(studio.openingHours),
    makesOffer: offer(input),
  });
}

function faqPage(input: JsonLdInput): JsonObject {
  return {
    "@type": "FAQPage",
    "@id": `${input.pageUrl}#faq`,
    mainEntity: input.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** JSON serializado y seguro para insertar en <script type="application/ld+json">. */
export function buildJsonLd(input: JsonLdInput): string {
  const graph = { "@context": "https://schema.org", "@graph": [localBusiness(input), faqPage(input)] };
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
