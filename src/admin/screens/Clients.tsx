import { useState, type SubmitEvent } from "react";
import { api } from "../../client/lib/api";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import type { Client } from "../../client/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputClass, Spinner } from "../../client/components/ui";

export function ClientsScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");
  const [creating, setCreating] = useState(false);

  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (search.trim()) query.set("q", search.trim());
  const state = useAsync(() => api.get<{ clients: Client[] }>(`/clients?${query}`), `${status}|${search}`);

  return (
    <>
      <Card
        title="Clientes"
        actions={<Button onClick={() => setCreating((value) => !value)}>{creating ? "Cerrar" : "Nuevo cliente"}</Button>}
      >
        {creating && (
          <NewClientForm
            onDone={async () => {
              setCreating(false);
              await state.reload();
            }}
          />
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre o email"
              className={inputClass}
            />
          </Field>
          <Field label="Estado">
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputClass}>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        {state.loading && <Spinner />}
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        {!state.loading && (state.data?.clients.length ?? 0) === 0 && <Empty>No hay clientes con ese filtro.</Empty>}
        {(state.data?.clients.length ?? 0) > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Listado de clientes</caption>
              <thead>
                <tr className="border-b border-stone/40 text-left text-[0.6875rem] tracking-[0.14em] uppercase text-stone-text">
                  <th scope="col" className="py-2 pr-3 font-semibold">Nombre</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Email</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Teléfono</th>
                  <th scope="col" className="py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {state.data?.clients.map((client) => (
                  <tr key={client.id} className="border-b border-stone/25 last:border-0">
                    <td className="py-2.5 pr-3">
                      <a href={`#/clientes/${client.id}`} className="text-link font-medium">
                        {client.name}
                      </a>
                    </td>
                    <td className="py-2.5 pr-3 text-stone-text">{client.email ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-stone-text">{client.phone ?? "—"}</td>
                    <td className="py-2.5">
                      <Badge tone={client.status === "active" ? "ok" : "neutral"}>
                        {client.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function NewClientForm({ onDone }: { onDone: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/clients", form);
      await onDone();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 grid gap-3 rounded-xl border border-stone/40 bg-sand/50 p-4 md:grid-cols-4">
      <Field label="Nombre">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Teléfono">
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Crear cliente"}
        </Button>
      </div>
      {error && <div className="md:col-span-4"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}
