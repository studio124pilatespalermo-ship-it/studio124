import { useState, type SubmitEvent } from "react";
import { api } from "../../client/lib/api";
import { longDate, money, MOVEMENT_LABEL, PACK_STATUS_LABEL, shortDate, weekdayName } from "../../client/lib/format";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import type { Client, CreditMovement, PackBalance, PackRow, TemplateSlot } from "../../client/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";
import { RegisterPaymentForm } from "./client/RegisterPayment";
import { LoadSlotsPanel } from "./client/LoadSlots";
import { FixedSlotsForm } from "./client/FixedSlots";

interface ClientDetail {
  readonly client: Client;
  readonly balances: PackBalance[];
  readonly packs: PackRow[];
  readonly fixedSlots: { id: string; templateSlotId: string; weekday: number; startTime: string }[];
  readonly movements: CreditMovement[];
}

export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const [openPackId, setOpenPackId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const state = useAsync(() => api.get<ClientDetail>(`/clients/${clientId}`), clientId);
  const template = useAsync(() => api.get<{ template: TemplateSlot[] }>("/schedule/template"));

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;
  if (!state.data) return <Empty>Cliente no encontrado.</Empty>;

  const { client, balances, packs, fixedSlots, movements } = state.data;
  const activeBalances = balances.filter((balance) => balance.status === "active");

  async function refresh(message?: string) {
    setNote(message ?? null);
    await state.reload();
  }

  return (
    <>
      <Card
        title={client.name}
        actions={
          <a href="#/clientes" className="text-link text-sm">
            ← Volver a clientes
          </a>
        }
      >
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-stone-text">Email</dt>
            <dd>{client.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-text">Teléfono</dt>
            <dd>{client.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-text">Estado</dt>
            <dd>
              <Badge tone={client.status === "active" ? "ok" : "neutral"}>
                {client.status === "active" ? "Activo" : "Inactivo"}
              </Badge>
            </dd>
          </div>
        </dl>
        {note && <p className="mt-4 rounded-lg bg-sand px-3 py-2 text-sm">{note}</p>}
      </Card>

      <Card title="Turnos fijos">
        <p className="mb-4 text-sm text-stone-text">
          Días y horarios habituales del cliente sobre la agenda modelo. Se usan para proponer turnos al cargar un abono.
        </p>
        {fixedSlots.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-2">
            {fixedSlots.map((slot) => (
              <li key={slot.id}>
                <Badge>
                  {weekdayName(slot.weekday)} {slot.startTime}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <FixedSlotsForm
          clientId={clientId}
          template={template.data?.template ?? []}
          selected={fixedSlots.map((slot) => slot.templateSlotId)}
          onSaved={() => refresh("Turnos fijos actualizados.")}
        />
      </Card>

      <Card title="Registrar un pago">
        <RegisterPaymentForm clientId={clientId} onDone={() => refresh("Pago registrado y clases cargadas.")} />
      </Card>

      <Card title="Abonos">
        {packs.length === 0 ? (
          <Empty>Todavía no tiene pagos registrados.</Empty>
        ) : (
          <ul className="space-y-3">
            {packs.map((pack) => {
              const balance = balances.find((item) => item.packId === pack.id);
              return (
                <li key={pack.id} className="rounded-xl border border-stone/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{pack.categoryName}</p>
                      <p className="text-sm text-stone-text">
                        {longDate(pack.startsOn)} → {longDate(pack.endsOn)} · {pack.methodName} ·{" "}
                        {money(pack.amountMinor, pack.currency)}
                      </p>
                      {pack.note && <p className="mt-1 text-xs text-stone-text">{pack.note}</p>}
                    </div>
                    <div className="text-right">
                      <Badge tone={pack.status === "active" ? "ok" : pack.status === "expired" ? "warn" : "neutral"}>
                        {PACK_STATUS_LABEL[pack.status] ?? pack.status}
                      </Badge>
                      <p className="mt-1 text-sm tabular-nums">
                        {balance?.remaining ?? 0} de {pack.classesTotal} clases
                      </p>
                    </div>
                  </div>

                  {pack.status === "active" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => setOpenPackId(openPackId === pack.id ? null : pack.id)}>
                        {openPackId === pack.id ? "Cerrar" : "Cargar turnos"}
                      </Button>
                      <AdjustButton packId={pack.id} clientId={clientId} onDone={refresh} />
                    </div>
                  )}

                  {openPackId === pack.id && (
                    <LoadSlotsPanel packId={pack.id} onDone={() => refresh("Turnos cargados.")} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {activeBalances.length === 0 && packs.length > 0 && (
          <p className="mt-4 text-sm text-stone-text">No tiene abonos activos: registrá un pago para que pueda reservar.</p>
        )}
      </Card>

      <Card title="Libro de movimientos">
        <p className="mb-4 text-sm text-stone-text">
          El saldo de cada abono es la suma de estos movimientos. Así queda explicado por qué tiene las clases que tiene.
        </p>
        {movements.length === 0 ? (
          <Empty>Sin movimientos.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-baseline justify-between gap-4 border-b border-stone/25 pb-2 last:border-0">
                <span>
                  {MOVEMENT_LABEL[movement.reason] ?? movement.reason}
                  {movement.note && <span className="text-stone-text"> · {movement.note}</span>}
                </span>
                <span className={`tabular-nums ${movement.delta > 0 ? "text-olive" : "text-terracotta-deep"}`}>
                  {movement.delta > 0 ? "+" : ""}
                  {movement.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AdjustButton({
  packId,
  clientId,
  onDone,
}: {
  packId: string;
  clientId: string;
  onDone: (message: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await api.post(`/clients/${clientId}/packs/${packId}/adjust`, { delta, note });
      setOpen(false);
      setNote("");
      await onDone("Ajuste registrado.");
    } catch (err) {
      setError(messageOf(err));
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Ajustar clases
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-lg bg-sand/60 p-3">
      <label className="text-sm">
        <span className="block text-xs text-stone-text">Clases</span>
        <input
          type="number"
          value={delta}
          onChange={(event) => setDelta(Number(event.target.value))}
          className="w-20 rounded-lg border border-stone/50 bg-cream px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex-1 text-sm">
        <span className="block text-xs text-stone-text">Motivo (obligatorio)</span>
        <input
          required
          minLength={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ej. clase de cortesía por feriado"
          className="w-full rounded-lg border border-stone/50 bg-cream px-2 py-1.5 text-sm"
        />
      </label>
      <Button type="submit">Guardar</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      {error && <div className="w-full"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}

export { shortDate };
