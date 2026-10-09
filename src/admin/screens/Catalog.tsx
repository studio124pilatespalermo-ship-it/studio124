import { useState, type SubmitEvent } from "react";
import { api } from "../lib/api";
import { CATEGORY_KIND_LABEL, longDate, money } from "../lib/format";
import { messageOf, useAsync } from "../lib/useAsync";
import type { Holiday, PaymentCategory, PaymentMethod, Professional } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputClass, Spinner } from "../components/ui";

interface CatalogData {
  readonly categories: PaymentCategory[];
  readonly methods: PaymentMethod[];
  readonly professionals: Professional[];
  readonly holidays: Holiday[];
}

export function CatalogScreen() {
  const state = useAsync(() => api.get<CatalogData>("/catalog"));
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await state.reload();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;

  return (
    <>
      {error && <ErrorNote>{error}</ErrorNote>}

      <Card title="Categorías de pago">
        <p className="mb-4 text-sm text-stone-text">
          Definen cuántas clases da cada pago y por cuánto tiempo. “Venta online” habilita comprarlo desde el portal.
        </p>
        <NewCategoryForm onCreated={() => state.reload()} />
        {state.data?.categories.length === 0 ? (
          <Empty>Todavía no hay categorías.</Empty>
        ) : (
          <ul className="mt-4 space-y-2">
            {state.data?.categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone/40 px-3 py-2.5 text-sm">
                <span>
                  <strong>{category.name}</strong>{" "}
                  <span className="text-stone-text">
                    · {CATEGORY_KIND_LABEL[category.kind]} · {category.classes} clase(s) · {category.validityDays} días ·{" "}
                    {money(category.priceMinor, category.currency)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {category.sellOnline && <Badge tone="ok">Venta online</Badge>}
                  {!category.active && <Badge>Inactiva</Badge>}
                  <button
                    type="button"
                    onClick={() => void act(() => api.patch(`/catalog/categories/${category.id}`, { active: !category.active }))}
                    className="text-link text-xs"
                  >
                    {category.active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(() => api.patch(`/catalog/categories/${category.id}`, { sellOnline: !category.sellOnline }))}
                    className="text-link text-xs"
                  >
                    {category.sellOnline ? "Quitar de venta online" : "Vender online"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Profesionales">
        <NewProfessionalForm onCreated={() => state.reload()} />
        <ul className="mt-4 space-y-2">
          {state.data?.professionals.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone/40 px-3 py-2.5 text-sm">
              <span>{person.name}</span>
              <span className="flex items-center gap-2">
                {!person.active && <Badge>Inactivo</Badge>}
                <button
                  type="button"
                  onClick={() => void act(() => api.patch(`/catalog/professionals/${person.id}`, { active: !person.active }))}
                  className="text-link text-xs"
                >
                  {person.active ? "Desactivar" : "Activar"}
                </button>
              </span>
            </li>
          ))}
        </ul>
        {state.data?.professionals.length === 0 && <Empty>Todavía no hay profesionales.</Empty>}
      </Card>

      <Card title="Medios de pago">
        <ul className="space-y-2">
          {state.data?.methods.map((method) => (
            <li key={method.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone/40 px-3 py-2.5 text-sm">
              <span>{method.name}</span>
              <span className="flex items-center gap-2">
                {!method.active && <Badge>Inactivo</Badge>}
                <button
                  type="button"
                  onClick={() => void act(() => api.patch(`/catalog/methods/${method.id}`, { active: !method.active }))}
                  className="text-link text-xs"
                >
                  {method.active ? "Desactivar" : "Activar"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Feriados">
        <p className="mb-4 text-sm text-stone-text">Los días cargados acá se saltean al generar la agenda del mes.</p>
        <NewHolidayForm onCreated={() => state.reload()} />
        {state.data?.holidays.length === 0 ? (
          <Empty>Sin feriados cargados.</Empty>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {state.data?.holidays.map((holiday) => (
              <li key={holiday.id} className="flex items-center justify-between gap-3 border-b border-stone/25 pb-2 last:border-0">
                <span>
                  {longDate(holiday.date)} · <span className="text-stone-text">{holiday.name}</span>
                </span>
                <button type="button" onClick={() => void act(() => api.delete(`/catalog/holidays/${holiday.id}`))} className="text-link text-xs text-terracotta-deep">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function NewCategoryForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", kind: "pack", classes: 4, validityDays: 30, price: 0 });
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/catalog/categories", {
        name: form.name,
        kind: form.kind,
        classes: form.classes,
        validityDays: form.validityDays,
        priceMinor: Math.round(form.price * 100),
      });
      setForm({ ...form, name: "", price: 0 });
      await onCreated();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-stone/40 bg-sand/50 p-4 md:grid-cols-6">
      <Field label="Nombre">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Tipo">
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={inputClass}>
          {Object.entries(CATEGORY_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Clases">
        <input type="number" min={1} max={60} value={form.classes} onChange={(e) => setForm({ ...form, classes: Number(e.target.value) })} className={inputClass} />
      </Field>
      <Field label="Vigencia (días)">
        <input type="number" min={1} max={400} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })} className={inputClass} />
      </Field>
      <Field label="Precio">
        <input type="number" min={0} step={100} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inputClass} />
      </Field>
      <div className="flex items-end">
        <Button type="submit">Agregar</Button>
      </div>
      {error && <div className="md:col-span-6"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}

function NewProfessionalForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/catalog/professionals", { name });
      setName("");
      await onCreated();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field label="Nombre">
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Button type="submit">Agregar</Button>
      {error && <div className="w-full"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}

function NewHolidayForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ date: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/catalog/holidays", form);
      setForm({ date: "", name: "" });
      await onCreated();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field label="Fecha">
        <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Nombre">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </Field>
      <Button type="submit">Agregar</Button>
      {error && <div className="w-full"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}
