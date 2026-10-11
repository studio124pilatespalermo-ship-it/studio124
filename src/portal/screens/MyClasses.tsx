import { useState } from "react";
import { api } from "../../client/lib/api";
import { longDate, shortDate } from "../../client/lib/format";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { Badge, Button, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";
import type { PortalBalance, PortalBooking, PortalConfig } from "../lib/types";

export function MyClasses({ config }: { config: PortalConfig }) {
  const [note, setNote] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const me = useAsync(
    () => api.get<{ balances: PortalBalance[] }>("/portal/me"),
    String(reloadKey),
  );
  const bookings = useAsync(
    () => api.get<{ bookings: PortalBooking[] }>("/portal/bookings"),
    String(reloadKey),
  );

  async function cancel(bookingId: string) {
    setNote(null);
    try {
      const result = await api.post<{ refunded: boolean }>(`/portal/bookings/${bookingId}/cancel`);
      setNote(
        result.refunded
          ? "Listo: cancelamos tu clase y te la devolvimos al abono."
          : "Cancelamos tu clase, pero por el poco tiempo de aviso no se recupera.",
      );
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNote(messageOf(error));
    }
  }

  const upcoming = (bookings.data?.bookings ?? []).filter((booking) => booking.status === "booked");
  const balances = me.data?.balances ?? [];
  const totalRemaining = balances.reduce((sum, balance) => sum + balance.remaining, 0);

  return (
    <>
      <Card title="Tu abono">
        {me.loading && <Spinner />}
        {me.error && <ErrorNote>{me.error}</ErrorNote>}
        {!me.loading && balances.length === 0 && (
          <Empty>No tenés un abono activo. Comprá clases o escribinos para registrarlo.</Empty>
        )}
        {balances.length > 0 && (
          <>
            <p className="font-serif text-4xl tabular-nums">
              {totalRemaining} <span className="text-xl text-stone-text">clase(s) disponibles</span>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-stone-text">
              {balances.map((balance) => (
                <li key={balance.packId}>
                  {balance.remaining} de {balance.classesTotal} · vence el {longDate(balance.endsOn)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Tus próximas clases">
        {note && <p className="mb-4 rounded-lg bg-sand px-3 py-2 text-sm">{note}</p>}
        {bookings.loading && <Spinner />}
        {bookings.error && <ErrorNote>{bookings.error}</ErrorNote>}
        {!bookings.loading && upcoming.length === 0 && <Empty>No tenés clases reservadas.</Empty>}

        {upcoming.length > 0 && (
          <ul className="space-y-3">
            {upcoming.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone/40 px-4 py-3"
              >
                <span>
                  <span className="block font-serif text-xl">{shortDate(booking.date)}</span>
                  <span className="text-sm text-stone-text">
                    {booking.startTime} · {booking.durationMin} min
                  </span>
                </span>
                <Button variant="ghost" onClick={() => void cancel(booking.id)}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-stone-text">
          Podés cancelar hasta {config.cancelWindowHours} h antes de la clase y la recuperás para otro día. Después de
          ese plazo, o si no venís, la clase se pierde.
        </p>
      </Card>

      <PastClasses bookings={bookings.data?.bookings ?? []} />
    </>
  );
}

function PastClasses({ bookings }: { bookings: PortalBooking[] }) {
  const closed = bookings.filter((booking) => booking.status !== "booked");
  if (closed.length === 0) return null;

  const labels: Record<string, { text: string; tone: "ok" | "bad" | "neutral" }> = {
    attended: { text: "Asististe", tone: "ok" },
    absent: { text: "No viniste", tone: "bad" },
    cancelled_on_time: { text: "Cancelada a tiempo", tone: "neutral" },
    cancelled_late: { text: "Cancelada tarde", tone: "bad" },
  };

  return (
    <Card title="Historial">
      <ul className="space-y-2 text-sm">
        {closed.map((booking) => {
          const label = labels[booking.status];
          return (
            <li
              key={booking.id}
              className="flex items-center justify-between gap-3 border-b border-stone/25 pb-2 last:border-0"
            >
              <span>
                {shortDate(booking.date)} · {booking.startTime}
              </span>
              {label && <Badge tone={label.tone}>{label.text}</Badge>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
