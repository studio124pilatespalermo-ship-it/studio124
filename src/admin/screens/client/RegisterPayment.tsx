import { useState, type SubmitEvent } from "react";
import { api } from "../../../client/lib/api";
import { money, todayIso } from "../../../client/lib/format";
import { messageOf, useAsync } from "../../../client/lib/useAsync";
import type { PaymentCategory, PaymentMethod } from "../../../client/lib/types";
import { Button, ErrorNote, Field, inputClass } from "../../../client/components/ui";

/**
 * Registrar un pago crea el abono con sus clases y su vigencia. No genera turnos:
 * eso se hace después, con "Cargar turnos", revisando la propuesta.
 */
export function RegisterPaymentForm({ clientId, onDone }: { clientId: string; onDone: () => Promise<void> }) {
  const catalog = useAsync(
    () => api.get<{ categories: PaymentCategory[]; methods: PaymentMethod[] }>("/catalog"));
  const [categoryId, setCategoryId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [startsOn, setStartsOn] = useState(todayIso());
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = (catalog.data?.categories ?? []).filter((category) => category.active);
  const methods = (catalog.data?.methods ?? []).filter((method) => method.active);
  const selected = categories.find((category) => category.id === categoryId);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/payments", {
        clientId,
        categoryId,
        methodId,
        startsOn,
        ...(endsOn ? { endsOn } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setNote("");
      setEndsOn("");
      await onDone();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (catalog.loading) return <p className="text-sm text-stone-text">Cargando categorías…</p>;
  if (catalog.error) return <ErrorNote>{catalog.error}</ErrorNote>;

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-5">
      <Field label="Categoría">
        <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">Elegir…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} · {category.classes} clase(s) · {money(category.priceMinor, category.currency)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Medio de pago">
        <select required value={methodId} onChange={(e) => setMethodId(e.target.value)} className={inputClass}>
          <option value="">Elegir…</option>
          {methods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Inicio">
        <input type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} />
      </Field>

      <Field
        label="Vencimiento"
        hint={selected && !endsOn ? `Por defecto: ${selected.validityDays} días` : undefined}
      >
        <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} />
      </Field>

      <div className="flex items-end">
        <Button type="submit" disabled={busy || !categoryId || !methodId}>
          {busy ? "Guardando…" : "Registrar pago"}
        </Button>
      </div>

      <div className="md:col-span-5">
        <Field label="Nota (opcional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {error && <div className="md:col-span-5"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}
