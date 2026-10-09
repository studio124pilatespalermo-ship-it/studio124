/**
 * Fechas de agenda en hora de Buenos Aires. Argentina usa UTC−3 todo el año (sin horario
 * de verano desde 2009); si eso cambiara, este es el único lugar a tocar.
 */
export const STUDIO_UTC_OFFSET = "-03:00";

export type IsoDate = string; // YYYY-MM-DD
export type ClockTime = string; // HH:MM

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isClockTime(value: string): boolean {
  return CLOCK_TIME.test(value);
}

/** Fecha de hoy en Buenos Aires. */
export function todayInStudio(now: Date = new Date()): IsoDate {
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Instante en que empieza un turno. */
export function slotStart(date: IsoDate, time: ClockTime): Date {
  return new Date(`${date}T${time}:00${STUDIO_UTC_OFFSET}`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: IsoDate): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Fechas desde `from` hasta `to`, ambas incluidas. */
export function datesBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const result: IsoDate[] = [];
  for (let current = from; current <= to; current = addDays(current, 1)) result.push(current);
  return result;
}

export function monthBounds(year: number, month: number): { from: IsoDate; to: IsoDate } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}
