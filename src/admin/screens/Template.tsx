import { useState, type SubmitEvent } from "react";
import { api } from "../../client/lib/api";
import { shortDate, todayIso, weekdayName, WEEKDAYS } from "../../client/lib/format";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import type { Professional, TemplateSlot } from "../../client/lib/types";
import { Button, Card, Empty, ErrorNote, Field, inputClass, Spinner } from "../../client/components/ui";

interface GeneratePreview {
  readonly from: string;
  readonly to: string;
  readonly toCreate: { date: string; startTime: string }[];
  readonly existing: number;
  readonly skippedHolidays: string[];
}

export function TemplateScreen() {
  const state = useAsync(() => api.get<{ template: TemplateSlot[] }>("/schedule/template"));
  const catalog = useAsync(() => api.get<{ professionals: Professional[] }>("/catalog"));
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setError(null);
    try {
      await api.delete(`/schedule/template/${id}`);
      await state.reload();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  const slots = state.data?.template.filter((slot) => slot.active) ?? [];
  const byWeekday = new Map<number, TemplateSlot[]>();
  for (const slot of slots) byWeekday.set(slot.weekday, [...(byWeekday.get(slot.weekday) ?? []), slot]);

  return (
    <>
      <Card title="Agenda modelo">
        <p className="text-sm text-stone-text">
          La semana tipo del estudio. Desde acá se genera la agenda de cada mes.
        </p>
        <div className="mt-4">
          <NewTemplateSlot professionals={catalog.data?.professionals ?? []} onCreated={() => state.reload()} />
        </div>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </Card>

      <Card>
        {state.loading && <Spinner />}
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        {!state.loading && slots.length === 0 && <Empty>Todavía no hay turnos en la agenda modelo.</Empty>}
        {slots.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WEEKDAYS.map((_, index) => {
              const weekday = index + 1;
              const daySlots = byWeekday.get(weekday) ?? [];
              if (daySlots.length === 0) return null;
              return (
                <div key={weekday}>
                  <h3 className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase text-stone-text">
                    {weekdayName(weekday)}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {daySlots.map((slot) => (
                      <li key={slot.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone/40 px-3 py-2 text-sm">
                        <span className="tabular-nums">
                          {slot.startTime} · {slot.capacity} lugares
                        </span>
                        <button type="button" onClick={() => void remove(slot.id)} className="text-link text-xs text-terracotta-deep">
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <GenerateMonth />
    </>
  );
}

function NewTemplateSlot({ professionals, onCreated }: { professionals: Professional[]; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ weekday: 1, startTime: "09:00", capacity: 6, durationMin: 55, professionalId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/schedule/template", {
        weekday: form.weekday,
        startTime: form.startTime,
        capacity: form.capacity,
        durationMin: form.durationMin,
        ...(form.professionalId ? { professionalId: form.professionalId } : {}),
      });
      await onCreated();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-stone/40 bg-sand/50 p-4 md:grid-cols-6">
      <Field label="Día">
        <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })} className={inputClass}>
          {WEEKDAYS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Hora">
        <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Cupo">
        <input type="number" min={1} max={30} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className={inputClass} />
      </Field>
      <Field label="Duración (min)">
        <input type="number" min={15} max={180} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} className={inputClass} />
      </Field>
      <Field label="Profesional">
        <select value={form.professionalId} onChange={(e) => setForm({ ...form, professionalId: e.target.value })} className={inputClass}>
          <option value="">Sin asignar</option>
          {professionals.filter((person) => person.active).map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Agregando…" : "Agregar"}
        </Button>
      </div>
      {error && <div className="md:col-span-6"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}

function GenerateMonth() {
  const today = todayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPreview() {
    setError(null);
    setMessage(null);
    try {
      setPreview(await api.get<GeneratePreview>(`/schedule/generate/preview?year=${year}&month=${month}`));
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ created: number }>("/schedule/generate", { year, month });
      setMessage(`Se crearon ${result.created} turnos. Los que ya existían quedaron intactos.`);
      await loadPreview();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Generar la agenda del mes">
      <p className="text-sm text-stone-text">
        Copia la agenda modelo al mes elegido. Sólo crea los turnos que faltan: nunca modifica ni borra los que ya
        están cargados, así que se puede usar varias veces sin riesgo.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Año">
          <input type="number" min={2024} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputClass} w-28`} />
        </Field>
        <Field label="Mes">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
        </Field>
        <Button variant="ghost" onClick={() => void loadPreview()}>
          Ver qué se crearía
        </Button>
        <Button onClick={() => void generate()} disabled={busy || !preview || preview.toCreate.length === 0}>
          {busy ? "Generando…" : "Generar mes"}
        </Button>
      </div>

      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {message && <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm">{message}</p>}

      {preview && (
        <div className="mt-4 rounded-xl bg-sand/60 p-4 text-sm">
          <p>
            <strong>{preview.toCreate.length}</strong> turnos nuevos · <strong>{preview.existing}</strong> ya cargados
            {preview.skippedHolidays.length > 0 && (
              <> · {preview.skippedHolidays.length} día(s) salteados por feriado</>
            )}
          </p>
          {preview.skippedHolidays.length > 0 && (
            <p className="mt-1 text-stone-text">Feriados: {preview.skippedHolidays.map(shortDate).join(", ")}</p>
          )}
        </div>
      )}
    </Card>
  );
}
