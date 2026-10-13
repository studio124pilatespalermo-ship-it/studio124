import { useState } from "react";
import { api } from "../../client/lib/api";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { Badge, Button, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";
import { fill, usePortalLocale, type PortalDictionary, type PortalLocale } from "../i18n";
import { longDate, shortDate } from "../lib/dates";
import type { PortalBalance, PortalBooking, PortalConfig } from "../lib/types";

export function MyClasses({ config }: { config: PortalConfig }) {
  const { t, locale } = usePortalLocale();
  const [note, setNote] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const me = useAsync(() => api.get<{ balances: PortalBalance[] }>("/portal/me"), String(reloadKey));
  const bookings = useAsync(() => api.get<{ bookings: PortalBooking[] }>("/portal/bookings"), String(reloadKey));

  async function cancel(bookingId: string) {
    setNote(null);
    try {
      const result = await api.post<{ refunded: boolean }>(`/portal/bookings/${bookingId}/cancel`);
      setNote(result.refunded ? t.bookings.cancelled : t.bookings.cancelledLate);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setNote(messageOf(error));
    }
  }

  const upcoming = (bookings.data?.bookings ?? []).filter((booking) => booking.status === "booked");
  const balances = me.data?.balances ?? [];
  const totalRemaining = balances.reduce((sum, balance) => sum + balance.remaining, 0);

  return (
    <>
      <Card title={t.balance.title}>
        {me.loading && <Spinner label={t.common.loading} />}
        {me.error && <ErrorNote>{me.error}</ErrorNote>}
        {!me.loading && balances.length === 0 && <Empty>{t.balance.none}</Empty>}
        {balances.length > 0 && (
          <>
            <p className="font-semibold text-4xl tabular-nums">
              {totalRemaining} <span className="text-xl text-stone-text">{t.balance.available}</span>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-stone-text">
              {balances.map((balance) => (
                <li key={balance.packId}>
                  {fill(t.balance.detail, {
                    remaining: balance.remaining,
                    total: balance.classesTotal,
                    date: longDate(balance.endsOn, locale),
                  })}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title={t.bookings.title}>
        {note && <p className="mb-4 rounded-lg bg-sand px-3 py-2 text-sm">{note}</p>}
        {bookings.loading && <Spinner label={t.common.loading} />}
        {bookings.error && <ErrorNote>{bookings.error}</ErrorNote>}
        {!bookings.loading && upcoming.length === 0 && <Empty>{t.bookings.none}</Empty>}

        {upcoming.length > 0 && (
          <ul className="space-y-3">
            {upcoming.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone/40 px-4 py-3"
              >
                <span>
                  <span className="block font-semibold text-xl">{shortDate(booking.date, locale)}</span>
                  <span className="text-sm text-stone-text">
                    {booking.startTime} · {booking.durationMin} {t.common.minutes}
                  </span>
                </span>
                <Button variant="ghost" onClick={() => void cancel(booking.id)}>
                  {t.bookings.cancel}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-stone-text">
          {fill(t.bookings.note, { hours: config.cancelWindowHours })}
        </p>
      </Card>

      <PastClasses bookings={bookings.data?.bookings ?? []} t={t} locale={locale} />
    </>
  );
}

const STATUS_TONE: Record<string, "ok" | "bad" | "neutral"> = {
  attended: "ok",
  absent: "bad",
  cancelled_on_time: "neutral",
  cancelled_late: "bad",
};

function PastClasses({
  bookings,
  t,
  locale,
}: {
  bookings: PortalBooking[];
  t: PortalDictionary;
  locale: PortalLocale;
}) {
  const closed = bookings.filter((booking) => booking.status !== "booked");
  if (closed.length === 0) return null;
  const labels: Record<string, string> = t.bookings.status;

  return (
    <Card title={t.bookings.historyTitle}>
      <ul className="space-y-2 text-sm">
        {closed.map((booking) => (
          <li
            key={booking.id}
            className="flex items-center justify-between gap-3 border-b border-stone/25 pb-2 last:border-0"
          >
            <span>
              {shortDate(booking.date, locale)} · {booking.startTime}
            </span>
            {labels[booking.status] && (
              <Badge tone={STATUS_TONE[booking.status] ?? "neutral"}>{labels[booking.status]}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
