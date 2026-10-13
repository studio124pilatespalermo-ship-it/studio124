import { useState, type SubmitEvent } from "react";
import { api } from "../../client/lib/api";
import { CATEGORY_KIND_LABEL, longDate, money } from "../../client/lib/format";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import type { Holiday, PaymentCategory, PaymentMethod, Professional } from "../../client/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputClass, Spinner } from "../../client/components/ui";

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
          Definen cuántas clases da cada pago y por cuánto tiempo. “Venta online” habilita comprarlo desde el portal;
          “En la landing” muestra el precio a los turistas en la página. Un cambio de precio se ve en la landing en
          menos de cinco minutos.
        </p>
        <NewCategoryForm onCreated={() => state.reload()} />
        {state.data?.categories.length === 0 ? (
          <Empty>Todavía no hay categorías.</Empty>
        ) : (
          <ul className="mt-4 space-y-2">
            {state.data?.categories.map((category) => (
              <CategoryRow key={category.id} category={category} onAction={act} />
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

/** Una categoría del catálogo: datos, estado y acciones (precio, activa, portal, landing). */
function CategoryRow({
  category,
  onAction,
}: {
  category: PaymentCategory;
  onAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(category.priceMinor / 100);
  // PATCH parcial: la API sólo toca el campo que se manda.
  const update = (body: Partial<PaymentCategory>) => onAction(() => api.patch(`/catalog/categories/${category.id}`, body));

  async function savePrice(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await update({ priceMinor: Math.round(price * 100) });
    setEditing(false);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone/40 bg-cream px-4 py-3 text-sm">
      <span>
        <strong>{category.name}</strong>{" "}
        <span className="text-stone-text">
          · {CATEGORY_KIND_LABEL[category.kind]} · {category.classes} clase(s) · {category.validityDays} días ·{" "}
        </span>
        {editing ? (
          <form onSubmit={savePrice} className="mt-2 flex items-center gap-2">
            <label className="sr-only" htmlFor={`price-${category.id}`}>
              Precio de {category.name}
            </label>
            <input
              id={`price-${category.id}`}
              type="number"
              min={0}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className={`${inputClass} w-32`}
            />
            <Button type="submit">Guardar</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <strong className="tabular-nums">{money(category.priceMinor, category.currency)}</strong>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {category.showOnLanding && <Badge tone="ok">En la landing</Badge>}
        {category.sellOnline && <Badge tone="ok">Venta online</Badge>}
        {!category.active && <Badge>Inactiva</Badge>}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-link text-xs">
            Cambiar precio
          </button>
        )}
        <button type="button" onClick={() => void update({ active: !category.active })} className="text-link text-xs">
          {category.active ? "Desactivar" : "Activar"}
        </button>
        <button type="button" onClick={() => void update({ sellOnline: !category.sellOnline })} className="text-link text-xs">
          {category.sellOnline ? "Quitar de venta online" : "Vender online"}
        </button>
        <button type="button" onClick={() => void update({ showOnLanding: !category.showOnLanding })} className="text-link text-xs">
          {category.showOnLanding ? "Quitar de la landing" : "Mostrar en la landing"}
        </button>
      </span>
    </li>
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
