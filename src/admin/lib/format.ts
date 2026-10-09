/** Formato para el panel: siempre en español y en hora de Buenos Aires. */

const LOCALE = "es-AR";

export function money(amountMinor: number, currency = "ARS"): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amountMinor / 100,
  );
}

/** "lun 13 oct" a partir de "2026-10-13", sin que el huso corra la fecha. */
export function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

export function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export function weekdayName(isoWeekday: number): string {
  return WEEKDAYS[isoWeekday - 1] ?? "—";
}

export function todayIso(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene `isoDate`. */
export function startOfWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return addDaysIso(isoDate, 1 - weekday);
}

export const PACK_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  expired: "Vencido",
  cancelled: "Cancelado",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  booked: "Reservado",
  attended: "Asistió",
  absent: "Ausente",
  cancelled_on_time: "Cancelado a tiempo",
  cancelled_late: "Cancelado tarde",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  loaded: "Clases cargadas",
  booked: "Clase reservada",
  refunded: "Clase devuelta",
  adjustment: "Ajuste manual",
  expired: "Vencimiento",
};

export const CATEGORY_KIND_LABEL: Record<string, string> = {
  trial: "Clase de prueba",
  single: "Clase única",
  single_duo: "Clase única dúo",
  pack: "Pack",
  monthly: "Abono mensual",
};
