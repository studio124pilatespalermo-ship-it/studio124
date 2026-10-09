import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { classSlots, holidays, templateSlots } from "../db/schema.ts";
import { datesBetween, isoWeekday, monthBounds, type IsoDate } from "../lib/dates.ts";
import { AppError } from "../lib/errors.ts";

/**
 * Agenda modelo → agenda del mes.
 *
 * "Generar mes" sólo CREA los turnos que faltan: nunca modifica ni borra los que ya existen,
 * así un cambio hecho a mano no se pierde al volver a generar. El índice único
 * (template_slot_id, date) hace que repetir la operación sea inofensivo.
 */

export interface GenerateOptions {
  readonly year: number;
  readonly month: number;
  readonly skipHolidays?: boolean | undefined;
}

export interface GeneratePreview {
  readonly from: IsoDate;
  readonly to: IsoDate;
  readonly toCreate: { date: IsoDate; startTime: string; templateSlotId: string }[];
  readonly existing: number;
  readonly skippedHolidays: IsoDate[];
}

async function plan(db: Database, options: GenerateOptions): Promise<GeneratePreview> {
  if (options.month < 1 || options.month > 12) throw new AppError("bad_request", "Mes inválido.");
  const { from, to } = monthBounds(options.year, options.month);

  const templates = await db.select().from(templateSlots).where(eq(templateSlots.active, true));
  const holidayRows = await db
    .select()
    .from(holidays)
    .where(and(sql`${holidays.date} >= ${from}`, sql`${holidays.date} <= ${to}`));
  const holidayDates = new Set(holidayRows.map((row) => row.date));

  const existingRows = await db
    .select({ templateSlotId: classSlots.templateSlotId, date: classSlots.date })
    .from(classSlots)
    .where(and(sql`${classSlots.date} >= ${from}`, sql`${classSlots.date} <= ${to}`));
  const existingKeys = new Set(existingRows.map((row) => `${row.templateSlotId}|${row.date}`));

  const toCreate: GeneratePreview["toCreate"] = [];
  const skipped = new Set<IsoDate>();
  for (const date of datesBetween(from, to)) {
    const isHoliday = holidayDates.has(date);
    for (const template of templates) {
      if (template.weekday !== isoWeekday(date)) continue;
      if (isHoliday && options.skipHolidays !== false) {
        skipped.add(date);
        continue;
      }
      if (existingKeys.has(`${template.id}|${date}`)) continue;
      toCreate.push({ date, startTime: template.startTime, templateSlotId: template.id });
    }
  }
  return { from, to, toCreate, existing: existingRows.length, skippedHolidays: [...skipped].sort() };
}

/** Vista previa: qué turnos se crearían. No escribe nada. */
export function previewMonth(db: Database, options: GenerateOptions): Promise<GeneratePreview> {
  return plan(db, options);
}

/** Crea los turnos faltantes del mes. Repetirlo no duplica ni pisa nada. */
export async function generateMonth(db: Database, options: GenerateOptions): Promise<{ created: number } & GeneratePreview> {
  const preview = await plan(db, options);
  if (preview.toCreate.length === 0) return { ...preview, created: 0 };

  const templates = await db
    .select()
    .from(templateSlots)
    .where(
      inArray(
        templateSlots.id,
        preview.toCreate.map((item) => item.templateSlotId),
      ),
    );
  const byId = new Map(templates.map((template) => [template.id, template]));

  const rows = preview.toCreate.flatMap((item) => {
    const template = byId.get(item.templateSlotId);
    if (!template) return [];
    return [
      {
        date: item.date,
        startTime: template.startTime,
        durationMin: template.durationMin,
        capacity: template.capacity,
        professionalId: template.professionalId,
        templateSlotId: template.id,
      },
    ];
  });

  const inserted = await db.insert(classSlots).values(rows).onConflictDoNothing().returning({ id: classSlots.id });
  return { ...preview, created: inserted.length };
}
