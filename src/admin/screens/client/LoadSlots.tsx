import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { shortDate } from "../../lib/format";
import { messageOf, useAsync } from "../../lib/useAsync";
import { useDerivedState } from "../../lib/useDerivedState";
import type { SuggestedSlot } from "../../lib/types";
import { Button, Empty, ErrorNote } from "../../components/ui";

/**
 * Vista previa de "Cargar turnos": el sistema propone según los turnos fijos del cliente,
 * la administradora destilda lo que no corresponda y confirma. Nada se crea solo.
 */
export function LoadSlotsPanel({ packId, onDone }: { packId: string; onDone: () => Promise<void> }) {
  const state = useAsync(() => api.get<{ slots: SuggestedSlot[] }>(`/payments/${packId}/suggested-slots`), packId);
  const available = useMemo(
    () => new Set((state.data?.slots ?? []).filter((slot) => slot.available).map((slot) => slot.slotId)),
    [state.data],
  );
  const [selected, setSelected] = useDerivedState(available);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggle(slotId: string) {
    const next = new Set(selected);
    if (next.has(slotId)) next.delete(slotId);
    else next.add(slotId);
    setSelected(next);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ created: string[]; failed: { slotId: string; message: string }[] }>(
        `/payments/${packId}/load-slots`,
        { slotIds: [...selected] },
      );
      setResult(
        response.failed.length === 0
          ? `Se cargaron ${response.created.length} turnos.`
          : `Se cargaron ${response.created.length} turnos; ${response.failed.length} no se pudieron cargar.`,
      );
      await onDone();
      await state.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) return <p className="mt-3 text-sm text-stone-text">Buscando turnos…</p>;
  if (state.error) return <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div>;

  const slots = state.data?.slots ?? [];
  if (slots.length === 0) {
    return (
      <div className="mt-3">
        <Empty>
          No hay turnos para proponer. Revisá que el cliente tenga turnos fijos y que el mes esté generado en la agenda.
        </Empty>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-sand/60 p-4">
      <p className="text-sm text-stone-text">
        Propuesta según los turnos fijos del cliente, dentro de la vigencia del abono. Revisá y confirmá.
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <li key={slot.slotId}>
            <label className={`flex items-center gap-2 text-sm ${slot.available ? "" : "text-stone-text"}`}>
              <input
                type="checkbox"
                disabled={!slot.available}
                checked={selected.has(slot.slotId)}
                onChange={() => toggle(slot.slotId)}
                className="size-4 accent-[#1f1d1b]"
              />
              <span className="tabular-nums">
                {shortDate(slot.date)} · {slot.startTime}
              </span>
              {!slot.available && <span className="text-xs">({slot.reason})</span>}
            </label>
          </li>
        ))}
      </ul>

      {result && <p className="mt-3 rounded-lg bg-bone px-3 py-2 text-sm">{result}</p>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => void confirm()} disabled={busy || selected.size === 0}>
          {busy ? "Cargando…" : `Confirmar ${selected.size} turno(s)`}
        </Button>
        <button type="button" onClick={() => setSelected(new Set())} className="text-link text-sm">
          Desmarcar todo
        </button>
      </div>
    </div>
  );
}
