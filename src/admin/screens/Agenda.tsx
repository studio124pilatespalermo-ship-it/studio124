import { useState } from "react";
import { api } from "../lib/api";
import { addDaysIso, shortDate, startOfWeek, todayIso } from "../lib/format";
import { messageOf, useAsync } from "../lib/useAsync";
import type { AgendaBooking, AgendaSlot } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Spinner } from "../components/ui";

/**
 * Agenda de la semana. Los indicadores replican los que usa el estudio:
 * cambió de turno, abono vencido, ausente y clase de prueba.
 */
export function AgendaScreen({ canEdit }: { canEdit: boolean }) {
  const [from, setFrom] = useState(() => startOfWeek(todayIso()));
  const [note, setNote] = useState<string | null>(null);
  const to = addDaysIso(from, 6);

  const state = useAsync(() => api.get<{ slots: AgendaSlot[] }>(`/schedule/agenda?from=${from}&to=${to}`), `${from}|${to}`);

  async function setAttendance(bookingId: string, status: "attended" | "absent" | "booked") {
    setNote(null);
    try {
      await api.post(`/schedule/bookings/${bookingId}/attendance`, { status });
      await state.reload();
    } catch (error) {
      setNote(messageOf(error));
    }
  }

  async function cancel(bookingId: string) {
    setNote(null);
    try {
      const result = await api.post<{ refunded: boolean }>(`/schedule/bookings/${bookingId}/cancel`, {});
      setNote(result.refunded ? "Cancelado: la clase volvió al abono." : "Cancelado fuera de plazo: la clase se perdió.");
      await state.reload();
    } catch (error) {
      setNote(messageOf(error));
    }
  }

  const byDate = new Map<string, AgendaSlot[]>();
  for (const slot of state.data?.slots ?? []) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }
  const days = Array.from({ length: 7 }, (_, index) => addDaysIso(from, index));

  return (
    <>
      <Card
        title="Agenda"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setFrom(addDaysIso(from, -7))}>
              ← Semana anterior
            </Button>
            <Button variant="ghost" onClick={() => setFrom(startOfWeek(todayIso()))}>
              Hoy
            </Button>
            <Button variant="ghost" onClick={() => setFrom(addDaysIso(from, 7))}>
              Semana siguiente →
            </Button>
          </div>
        }
      >
        <p className="text-sm text-stone-text">
          Del {shortDate(from)} al {shortDate(to)}. Hora de Buenos Aires.
        </p>
        {note && <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm">{note}</p>}
        {state.error && <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div>}
      </Card>

      {state.loading && <Spinner />}

      {!state.loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((date) => (
            <Card key={date} title={shortDate(date)}>
              {(byDate.get(date) ?? []).length === 0 ? (
                <Empty>Sin turnos.</Empty>
              ) : (
                <ul className="space-y-3">
                  {(byDate.get(date) ?? []).map((slot) => (
                    <SlotRow key={slot.id} slot={slot} canEdit={canEdit} onAttendance={setAttendance} onCancel={cancel} />
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function SlotRow({
  slot,
  canEdit,
  onAttendance,
  onCancel,
}: {
  slot: AgendaSlot;
  canEdit: boolean;
  onAttendance: (bookingId: string, status: "attended" | "absent" | "booked") => Promise<void>;
  onCancel: (bookingId: string) => Promise<void>;
}) {
  const active = slot.bookings.filter((booking) => !booking.status.startsWith("cancelled"));
  return (
    <li className={`rounded-xl border px-3 py-2.5 ${slot.status === "cancelled" ? "border-dashed border-stone/40 opacity-60" : "border-stone/40"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-lg tabular-nums">{slot.startTime}</span>
        <span className="text-xs text-stone-text">
          {slot.taken}/{slot.capacity}
          {slot.status === "cancelled" && " · cancelado"}
        </span>
      </div>
      {active.length === 0 ? (
        <p className="mt-1.5 text-xs text-stone-text">Sin reservas.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {active.map((booking) => (
            <BookingRow key={booking.id} booking={booking} canEdit={canEdit} onAttendance={onAttendance} onCancel={onCancel} />
          ))}
        </ul>
      )}
    </li>
  );
}

function BookingRow({
  booking,
  canEdit,
  onAttendance,
  onCancel,
}: {
  booking: AgendaBooking;
  canEdit: boolean;
  onAttendance: (bookingId: string, status: "attended" | "absent" | "booked") => Promise<void>;
  onCancel: (bookingId: string) => Promise<void>;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5">
        <a href={`#/clientes/${booking.clientId}`} className="text-link">
          {booking.clientName}
        </a>
        {booking.changedFromId && (
          <span title="Cambió de turno" aria-label="Cambió de turno">
            ⇄
          </span>
        )}
        {booking.status === "absent" && <Badge tone="bad">Ausente</Badge>}
        {booking.status === "attended" && <Badge tone="ok">Asistió</Badge>}
      </span>
      <span className="flex gap-2 text-xs">
        <button type="button" onClick={() => void onAttendance(booking.id, "attended")} className="text-link">
          Asistió
        </button>
        <button type="button" onClick={() => void onAttendance(booking.id, "absent")} className="text-link">
          Ausente
        </button>
        {canEdit && (
          <button type="button" onClick={() => void onCancel(booking.id)} className="text-link text-terracotta-deep">
            Cancelar
          </button>
        )}
      </span>
    </li>
  );
}
