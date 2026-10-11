import { api } from "../../client/lib/api";
import { addDaysIso, money, shortDate, todayIso } from "../../client/lib/format";
import { useAsync } from "../../client/lib/useAsync";
import type { AgendaSlot, PackRow } from "../../client/lib/types";
import { Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";

interface ClientStats {
  readonly active: number;
  readonly inactive: number;
  readonly newByMonth: { month: string; value: number }[];
}

export function DashboardScreen() {
  const today = todayIso();
  const stats = useAsync(() => api.get<ClientStats>("/clients/stats"));
  const agenda = useAsync(() => api.get<{ slots: AgendaSlot[] }>(`/schedule/agenda?from=${today}&to=${today}`), today);
  const payments = useAsync(() => api.get<{ packs: PackRow[] }>("/payments"));
  const expiring = useAsync(
    () => api.get<{ packs: { packId: string; clientName: string; endsOn: string }[] }>("/payments/expiring?days=7"));

  const month = today.slice(0, 7);
  const monthTotal = (payments.data?.packs ?? [])
    .filter((pack) => pack.startsOn.startsWith(month))
    .reduce((sum, pack) => sum + pack.amountMinor, 0);

  const todaySlots = agenda.data?.slots ?? [];
  const todayBookings = todaySlots.reduce((sum, slot) => sum + slot.taken, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Clientes activos" value={stats.data?.active ?? "—"} />
        <Metric label="Clientes inactivos" value={stats.data?.inactive ?? "—"} />
        <Metric label="Reservas de hoy" value={todayBookings} />
        <Metric label={`Cobrado en ${month}`} value={money(monthTotal)} />
      </div>

      <Card title="Hoy">
        {agenda.loading && <Spinner />}
        {agenda.error && <ErrorNote>{agenda.error}</ErrorNote>}
        {!agenda.loading && todaySlots.length === 0 && <Empty>No hay turnos cargados para hoy.</Empty>}
        {todaySlots.length > 0 && (
          <ul className="space-y-2 text-sm">
            {todaySlots.map((slot) => (
              <li key={slot.id} className="flex items-baseline justify-between gap-3 border-b border-stone/25 pb-2 last:border-0">
                <span className="font-serif text-lg tabular-nums">{slot.startTime}</span>
                <span className="flex-1 px-4 text-stone-text">
                  {slot.bookings
                    .filter((booking) => !booking.status.startsWith("cancelled"))
                    .map((booking) => booking.clientName)
                    .join(", ") || "Sin reservas"}
                </span>
                <span className="tabular-nums text-stone-text">
                  {slot.taken}/{slot.capacity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleList
          title="Abonos por vencer"
          loading={expiring.loading}
          empty="Ninguno vence esta semana."
          rows={(expiring.data?.packs ?? []).map((row) => ({
            key: row.packId,
            left: row.clientName,
            right: shortDate(row.endsOn),
          }))}
        />
        <SimpleList
          title="Altas por mes"
          loading={stats.loading}
          empty="Sin datos todavía."
          rows={(stats.data?.newByMonth ?? []).map((row) => ({
            key: row.month,
            left: row.month,
            right: `${row.value} cliente(s)`,
          }))}
        />
      </div>

      <p className="text-xs text-stone-text">
        Semana del {shortDate(today)} al {shortDate(addDaysIso(today, 6))} · Hora de Buenos Aires.
      </p>
    </>
  );
}

function SimpleList({
  title,
  loading,
  empty,
  rows,
}: {
  title: string;
  loading: boolean;
  empty: string;
  rows: { key: string; left: string; right: string }[];
}) {
  return (
    <Card title={title}>
      {loading && <Spinner />}
      {!loading && rows.length === 0 && <Empty>{empty}</Empty>}
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline justify-between gap-3 border-b border-stone/25 pb-2 last:border-0">
            <span className="tabular-nums">{row.left}</span>
            <span className="tabular-nums text-stone-text">{row.right}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-stone/40 bg-bone p-5">
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase text-stone-text">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums">{value}</p>
    </div>
  );
}
