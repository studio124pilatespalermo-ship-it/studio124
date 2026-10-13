/**
 * Datos variables del estudio. Es el ÚNICO archivo que hay que tocar para cambiar
 * precio, horarios, dirección o redes. Los textos de la página viven en src/i18n/.
 *
 * Convención: un valor entre llaves dobles ({{ASI}}) o `null` es un dato pendiente.
 * Se muestra resaltado en la página y el build lista todos los pendientes al terminar.
 * El link de reserva NO está acá: sale de la variable de entorno PUBLIC_BOOKING_URL.
 */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Hora en formato 24 h "HH:MM", o un placeholder mientras no esté confirmada. */
export type TimeValue = `${number}:${number}` | `{{${string}}}`;

export interface ScheduleGroup {
  /** Días consecutivos que comparten los mismos horarios de clase. */
  readonly days: readonly DayKey[];
  readonly times: readonly TimeValue[];
}

export interface OpeningHours {
  readonly days: readonly DayKey[];
  readonly opens: TimeValue;
  readonly closes: TimeValue;
}

export interface Money {
  /** Monto en unidades menores enteras (centavos). `null` = pendiente. */
  readonly amountMinor: number | null;
  /** Código ISO 4217. */
  readonly currency: "ARS" | "USD";
}

export interface StudioData {
  readonly name: string;
  readonly dropInPrice: Money;
  readonly classDurationMinutes: number | null;
  readonly maxPeoplePerClass: number;
  readonly minimumAge: number | null;
  /** Anticipación mínima para reprogramar una clase, en horas. */
  readonly rescheduleNoticeHours: number | null;
  /** Cantidades de clases que vende el estudio en pack. */
  readonly packSizes: readonly number[];
  /** Semanas de validez de un pack, contadas desde la compra. `null` = pendiente. */
  readonly packValidityWeeks: number | null;
  readonly classSchedule: readonly ScheduleGroup[];
  readonly openingHours: readonly OpeningHours[];
  readonly address: {
    readonly street: string;
    readonly neighborhood: string;
    readonly city: string;
    readonly postalCode: string;
    readonly countryCode: "AR";
    /** Entre qué calles queda; ayuda a ubicarse a quien no conoce la ciudad. `null` = no mostrar. */
    readonly betweenStreets: readonly [string, string] | null;
  };
  /** Coordenadas para el JSON-LD. `null` = pendiente (no se publican coordenadas inventadas). */
  readonly geo: { readonly latitude: number; readonly longitude: number } | null;
  readonly links: {
    readonly instagram: string;
    readonly facebook: string;
    readonly googleReviews: string;
    readonly googleMaps: string;
  };
  /** Número en formato internacional, sólo dígitos (ej. 5491100000000). */
  readonly whatsappNumber: string;
  readonly email: string;
  /**
   * Lugares que nombra el párrafo de "The Experience", por id (los mismos ids que en
   * `experience.places` de i18n, donde está el nombre en cada idioma).
   * Valor: texto de búsqueda en Google Maps, o una URL completa de la ficha si la tenés.
   */
  readonly nearbyPlaces: Readonly<Record<string, string>>;
}

const WEEKDAYS: readonly DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export const studio = {
  name: "Studio124",

  dropInPrice: { amountMinor: null, currency: "ARS" },
  classDurationMinutes: 50,
  maxPeoplePerClass: 6,
  minimumAge: 14,
  rescheduleNoticeHours: null,

  // Packs publicados por el estudio: se usan dentro de 4 semanas contadas desde la compra,
  // no desde el inicio del mes.
  packSizes: [4, 8, 12, 16],
  packValidityWeeks: 4,

  // Grilla publicada por el estudio. La disponibilidad real de cada turno se ve al reservar.
  classSchedule: [
    { days: WEEKDAYS, times: ["08:00", "09:00", "10:00", "16:00", "17:00", "18:00", "19:00", "20:00"] },
    { days: ["sat"], times: ["08:00", "09:00", "10:00", "11:00", "12:00"] },
  ],

  // Horario de atención publicado por el estudio (coincide con su ficha de Google Maps).
  // Domingo: cerrado (por eso no figura).
  openingHours: [
    { days: WEEKDAYS, opens: "08:00", closes: "21:00" },
    { days: ["sat"], opens: "08:00", closes: "12:00" },
  ],

  address: {
    street: "Guatemala 4827",
    neighborhood: "Palermo Soho",
    city: "Buenos Aires",
    postalCode: "C1425BUO",
    countryCode: "AR",
    betweenStreets: ["Thames", "J. L. Borges"],
  },
  geo: { latitude: -34.5851706, longitude: -58.425463 },

  links: {
    instagram: "https://www.instagram.com/studio124.pilates/",
    facebook: "{{FACEBOOK_URL}}",
    googleReviews: "{{GOOGLE_RESENAS_URL}}",
    // Ficha de Google Maps del estudio (sin parámetros de rastreo).
    googleMaps: "https://www.google.com/maps/place/Studio124+Pilates+Reformer/data=!4m2!3m1!1s0x0:0x3aa9b1bba89a3df9",
  },
  whatsappNumber: "5491168309759",
  email: "studio124pilates.palermo@gmail.com",

  nearbyPlaces: {
    "don-julio": "Parrilla Don Julio, Palermo, Buenos Aires",
    "el-preferido": "El Preferido de Palermo, Buenos Aires",
    "jardin-botanico": "Jardín Botánico Carlos Thays, Palermo, Buenos Aires",
    "plaza-serrano": "Plaza Serrano, Palermo Soho, Buenos Aires",
    "distrito-arcos": "Distrito Arcos, Palermo, Buenos Aires",
    "la-rural": "La Rural, Predio Ferial de Buenos Aires",
  },
} as const satisfies StudioData;
