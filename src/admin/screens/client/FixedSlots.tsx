import { useMemo, useState } from "react";
import { api } from "../../../client/lib/api";
import { weekdayName } from "../../../client/lib/format";
import { messageOf } from "../../../client/lib/useAsync";
import { useDerivedState } from "../../../client/lib/useDerivedState";
import type { TemplateSlot } from "../../../client/lib/types";
import { Button, Empty, ErrorNote } from "../../../client/components/ui";

function toggled(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Asigna al cliente sus turnos fijos sobre la agenda modelo. */
export function FixedSlotsForm({
  clientId,
  template,
  selected,
  onSaved,
}: {
  clientId: string;
  template: TemplateSlot[];
  selected: string[];
  onSaved: () => Promise<void>;
}) {
  const initial = useMemo(() => new Set(selected), [selected]);
  const [picked, setPicked] = useDerivedState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const active = template.filter((slot) => slot.active);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/clients/${clientId}/fixed-slots`, { templateSlotIds: [...picked] });
      setOpen(false);
      await onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {selected.length > 0 ? "Cambiar turnos fijos" : "Asignar turnos fijos"}
      </Button>
    );
  }

  if (active.length === 0) {
    return <Empty>Todavía no hay turnos en la agenda modelo. Cargalos en “Agenda modelo”.</Empty>;
  }

  const byWeekday = new Map<number, TemplateSlot[]>();
  for (const slot of active) byWeekday.set(slot.weekday, [...(byWeekday.get(slot.weekday) ?? []), slot]);

  return (
    <div className="rounded-xl bg-sand/60 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...byWeekday.entries()]
          .sort(([a], [b]) => a - b)
          .map(([weekday, slots]) => (
            <div key={weekday}>
              <p className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase text-stone-text">
                {weekdayName(weekday)}
              </p>
              <ul className="mt-1.5 space-y-1">
                {slots.map((slot) => (
                  <li key={slot.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={picked.has(slot.id)}
                        onChange={() => setPicked(toggled(picked, slot.id))}
                        className="size-4 accent-[#1f1d1b]"
                      />
                      <span className="tabular-nums">{slot.startTime}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-4 flex gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
