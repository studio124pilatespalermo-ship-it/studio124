import { api } from "../../../client/lib/api";
import { useAsync } from "../../../client/lib/useAsync";
import { Card, ErrorNote, Spinner } from "../../../client/components/ui";
import type { AgendaSlot } from "../../../client/lib/types";

/**
 * Calendario del mes: una celda por día con sus turnos y cuánto están ocupados.
 * Sirve para ver de un vistazo dónde falta gente; el detalle está en la vista semanal.
 */
const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

function monthBounds(year: number, month: number): { from: string; to: string; days: number } {
  const pad = (value: number) => String(value).padStart(2, "0");
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(days)}`, days };
}

/** Día de la semana ISO (1 = lunes) del primer día del mes. */
function firstWeekday(year: number, month: number): number {
  const day = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function MonthView({
  year,
  month,
  onPickDay,
}: {
  year: number;
  month: number;
  onPickDay: (date: string) => void;
}) {
  const { from, to, days } = monthBounds(year, month);
  const state = useAsync(() => api.get<{ slots: AgendaSlot[] }>(`/schedule/agenda?from=${from}&to=${to}`), `${from}`);

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;

  const byDate = new Map<string, AgendaSlot[]>();
  for (const slot of state.data?.slots ?? []) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }

  const leading = firstWeekday(year, month) - 1;
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: days }, (_, index) => `${from.slice(0, 8)}${String(index + 1).padStart(2, "0")}`),
  ];

  return (
    <Card>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-stone-text">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={index} aria-hidden="true">
            {initial}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
          const slots = byDate.get(date) ?? [];
          const taken = slots.reduce((sum, slot) => sum + slot.taken, 0);
          const capacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
          const full = capacity > 0 && taken >= capacity;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onPickDay(date)}
              className={`min-h-[4.5rem] rounded-lg border p-1.5 text-left transition-colors ${
                slots.length === 0
                  ? "border-dashed border-stone/30 text-stone-text"
                  : "border-stone/45 hover:border-ink hover:bg-sand"
              }`}
            >
              <span className="block text-sm tabular-nums">{Number(date.slice(8))}</span>
              {slots.length > 0 && (
                <>
                  <span className="mt-1 block text-[0.625rem] text-stone-text">
                    {slots.length} turno{slots.length === 1 ? "" : "s"}
                  </span>
                  <span className={`block text-[0.625rem] tabular-nums ${full ? "text-terracotta-deep" : "text-olive"}`}>
                    {taken}/{capacity}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-stone-text">
        Tocá un día para ver su semana en detalle. El número de abajo es gente anotada sobre cupo total.
      </p>
    </Card>
  );
}
