import { useState } from "react";
import { api } from "../../client/lib/api";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { useDerivedState } from "../../client/lib/useDerivedState";
import { Button, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";
import { fill, usePortalLocale } from "../i18n";
import { shortDate } from "../lib/dates";
import type { PortalConfig, PortalSlot } from "../lib/types";

/**
 * Reserva: los turnos libres se agrupan por día. En el celular se elige primero el día
 * con una fila de fichas y después el horario, que es menos scroll que una grilla mensual.
 */
export function BookClass({ config }: { config: PortalConfig }) {
  const { t, locale } = usePortalLocale();
  const [reloadKey, setReloadKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const state = useAsync(() => api.get<{ slots: PortalSlot[] }>("/portal/available"), String(reloadKey));
  const slots = state.data?.slots ?? [];

  const days = [...new Set(slots.map((slot) => slot.date))].sort();
  const [day, setDay] = useDerivedState(days[0] ?? "");

  async function book(slotId: string) {
    setBusy(slotId);
    setNote(null);
    try {
      await api.post("/portal/bookings", { slotId });
      setNote(t.book.done);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setNote(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  if (state.loading) return <Spinner label={t.common.loading} />;
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;

  return (
    <Card title={t.book.title}>
      {note && <p className="mb-4 rounded-lg bg-sand px-3 py-2 text-sm">{note}</p>}

      {days.length === 0 ? (
        <Empty>{t.book.none}</Empty>
      ) : (
        <>
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((value) => (
              <li key={value}>
                <button
                  type="button"
                  onClick={() => setDay(value)}
                  aria-current={day === value ? "true" : undefined}
                  className={`inline-flex h-11 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors ${
                    day === value ? "bg-ink text-bone" : "border border-stone/45 text-ink hover:bg-sand"
                  }`}
                >
                  {shortDate(value, locale)}
                </button>
              </li>
            ))}
          </ul>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {slots
              .filter((slot) => slot.date === day)
              .map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone/40 px-4 py-3"
                >
                  <span>
                    <span className="block font-serif text-xl tabular-nums">{slot.startTime}</span>
                    <span className="text-xs text-stone-text">
                      {fill(t.book.spots, { minutes: slot.durationMin, free: slot.free })}
                    </span>
                  </span>
                  <Button onClick={() => void book(slot.id)} disabled={busy !== null}>
                    {busy === slot.id ? t.book.reserving : t.book.reserve}
                  </Button>
                </li>
              ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-stone-text">{fill(t.book.note, { hours: config.changeWindowHours })}</p>
    </Card>
  );
}
