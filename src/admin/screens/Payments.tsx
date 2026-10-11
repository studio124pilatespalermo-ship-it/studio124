import { useState } from "react";
import { api } from "../../client/lib/api";
import { longDate, money, PACK_STATUS_LABEL } from "../../client/lib/format";
import { useAsync } from "../../client/lib/useAsync";
import type { PackRow } from "../../client/lib/types";
import { Badge, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";

interface ExpiredRow {
  readonly packId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly email: string | null;
  readonly endsOn: string;
}

interface ExpiringRow {
  readonly packId: string;
  readonly clientName: string;
  readonly endsOn: string;
}

type Tab = "all" | "expiring" | "expired";

export function PaymentsScreen() {
  const [tab, setTab] = useState<Tab>("all");
  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Todos los pagos" },
    { id: "expiring", label: "Por vencer" },
    { id: "expired", label: "Vencidos" },
  ];

  return (
    <>
      <Card title="Pagos y abonos">
        <nav aria-label="Vistas de pagos">
          <ul className="flex flex-wrap gap-1">
            {tabs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "true" : undefined}
                  className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors ${
                    tab === item.id ? "bg-ink text-bone" : "text-stone-text hover:bg-sand"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </Card>

      {tab === "all" && <AllPayments />}
      {tab === "expiring" && <ExpiringPacks />}
      {tab === "expired" && <ExpiredPacks />}
    </>
  );
}

function AllPayments() {
  const state = useAsync(() => api.get<{ packs: PackRow[] }>("/payments"));
  const packs = state.data?.packs ?? [];

  return (
    <Card>
      {state.loading && <Spinner />}
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {!state.loading && packs.length === 0 && <Empty>Todavía no hay pagos registrados.</Empty>}
      {packs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Pagos registrados</caption>
            <thead>
              <tr className="border-b border-stone/40 text-left text-[0.6875rem] tracking-[0.14em] uppercase text-stone-text">
                <th scope="col" className="py-2 pr-3 font-semibold">Cliente</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Categoría</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Medio</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Vigencia</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Monto</th>
                <th scope="col" className="py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id} className="border-b border-stone/25 last:border-0">
                  <td className="py-2.5 pr-3">
                    <a href={`#/clientes/${pack.clientId}`} className="text-link">
                      {pack.clientName}
                    </a>
                  </td>
                  <td className="py-2.5 pr-3">{pack.categoryName}</td>
                  <td className="py-2.5 pr-3 text-stone-text">{pack.methodName}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-stone-text">
                    {pack.startsOn} → {pack.endsOn}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{money(pack.amountMinor, pack.currency)}</td>
                  <td className="py-2.5">
                    <Badge tone={pack.status === "active" ? "ok" : pack.status === "expired" ? "warn" : "neutral"}>
                      {PACK_STATUS_LABEL[pack.status] ?? pack.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ExpiringPacks() {
  const state = useAsync(() => api.get<{ packs: ExpiringRow[] }>("/payments/expiring?days=7"));
  const packs = state.data?.packs ?? [];

  return (
    <Card>
      <p className="mb-3 text-sm text-stone-text">Abonos que vencen en los próximos 7 días.</p>
      {state.loading && <Spinner />}
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {!state.loading && packs.length === 0 && <Empty>Ninguno vence esta semana.</Empty>}
      <ul className="space-y-2 text-sm">
        {packs.map((row) => (
          <li key={row.packId} className="flex items-baseline justify-between gap-3 border-b border-stone/25 pb-2 last:border-0">
            <span>{row.clientName}</span>
            <span className="text-stone-text">vence el {longDate(row.endsOn)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ExpiredPacks() {
  const state = useAsync(() => api.get<{ packs: ExpiredRow[] }>("/payments/expired"));
  const packs = state.data?.packs ?? [];

  return (
    <Card>
      <p className="mb-3 text-sm text-stone-text">
        Abonos vencidos. El sistema envía el aviso por email automáticamente, una vez por vencimiento.
      </p>
      {state.loading && <Spinner />}
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {!state.loading && packs.length === 0 && <Empty>No hay abonos vencidos.</Empty>}
      <ul className="space-y-2 text-sm">
        {packs.map((row) => (
          <li
            key={row.packId}
            className="flex flex-wrap items-baseline justify-between gap-3 border-b border-stone/25 pb-2 last:border-0"
          >
            <a href={`#/clientes/${row.clientId}`} className="text-link">
              {row.clientName}
            </a>
            <span className="text-stone-text">
              venció el {longDate(row.endsOn)}
              {row.email ? "" : " · sin email cargado"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
