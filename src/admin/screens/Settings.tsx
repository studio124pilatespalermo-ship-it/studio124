import { useState } from "react";
import { api } from "../../client/lib/api";
import { dateTime } from "../../client/lib/format";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { useDerivedState } from "../../client/lib/useDerivedState";
import type { SecretStatus, Settings } from "../../client/lib/types";
import { Badge, Button, Card, ErrorNote, Field, inputClass, Spinner } from "../../client/components/ui";

const NUMBERS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "booking.changeWindowHours", label: "Horas para cambiar", hint: "Antes de la clase. El panel puede saltearlo." },
  { key: "booking.cancelWindowHours", label: "Horas para cancelar", hint: "Cancelado después, la clase se pierde." },
  { key: "booking.horizonDays", label: "Días de anticipación", hint: "Hasta cuándo puede reservar el cliente." },
  { key: "schedule.defaultDurationMin", label: "Duración por defecto", hint: "Minutos de cada clase nueva." },
  { key: "schedule.defaultCapacity", label: "Cupo por defecto", hint: "Personas por clase." },
];

const SWITCHES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "portal.allowBooking", label: "El cliente puede reservar", hint: "Si se apaga, sólo mira sus turnos." },
  { key: "portal.showAvailableSlots", label: "Mostrar turnos disponibles", hint: "Sección de turnos libres en el portal." },
  { key: "portal.showPayments", label: "Mostrar sección de pagos", hint: "Sus abonos y su historial." },
  { key: "portal.allowOnlinePayment", label: "Permitir pagar online", hint: "Checkout de Mercado Pago." },
  { key: "portal.allowSelfSignup", label: "Permitir que se registren solos", hint: "Si no, los carga administración." },
  { key: "staff.canMarkAttendance", label: "La instructora marca asistencia", hint: "Si se apaga, sólo administración." },
  { key: "notifications.expiryEmail", label: "Avisar vencimientos por email", hint: "Un aviso por abono vencido." },
];

export function SettingsScreen() {
  const state = useAsync(() => api.get<{ settings: Settings }>("/settings"));
  const [draft, setDraft] = useDerivedState<Settings | null>(state.data?.settings ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.patch("/settings", draft);
      setMessage("Configuración guardada.");
      await state.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (state.loading || !draft) return <Spinner />;
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;

  return (
    <>
      <Card title="Reglas de reserva">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBERS.map((item) => (
            <Field key={item.key} label={item.label} hint={item.hint}>
              <input
                type="number"
                min={0}
                value={draft[item.key] as number}
                onChange={(event) => setDraft({ ...draft, [item.key]: Number(event.target.value) })}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Qué ve y qué puede hacer el cliente">
        <ul className="space-y-3">
          {SWITCHES.map((item) => (
            <li key={item.key}>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft[item.key] as boolean}
                  onChange={(event) => setDraft({ ...draft, [item.key]: event.target.checked })}
                  className="mt-0.5 size-4 accent-[#1f1d1b]"
                />
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-xs text-stone-text">{item.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Guardando…" : "Guardar configuración"}
          </Button>
          {message && <span className="text-sm text-stone-text">{message}</span>}
        </div>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </Card>

      <SecretsCard />
    </>
  );
}

/**
 * Credenciales de integraciones. Se guardan cifradas y la API nunca las devuelve:
 * acá sólo se ve si están cargadas y sus últimos cuatro caracteres.
 */
function SecretsCard() {
  const state = useAsync(() => api.get<{ secrets: SecretStatus[] }>("/settings/secrets"));
  const [values, setValues] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(key: string) {
    const value = values[key]?.trim();
    if (!value) return;
    setBusyKey(key);
    setError(null);
    setMessage(null);
    try {
      await api.put(`/settings/secrets/${key}`, { value });
      setValues({ ...values, [key]: "" });
      setMessage("Credencial guardada y cifrada.");
      await state.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(key: string) {
    setBusyKey(key);
    setError(null);
    try {
      await api.delete(`/settings/secrets/${key}`);
      await state.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyKey(null);
    }
  }

  if (state.loading) return <Spinner />;

  return (
    <Card title="Credenciales">
      <p className="text-sm text-stone-text">
        Claves de Mercado Pago y del servicio de emails. Se guardan cifradas en la base y no se pueden volver a ver:
        si se pierde una, se carga de nuevo. Nunca las compartas por chat ni por email.
      </p>
      {state.error && <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {message && <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm">{message}</p>}

      <ul className="mt-4 space-y-4">
        {state.data?.secrets.map((secret) => (
          <li key={secret.key} className="rounded-xl border border-stone/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{secret.label}</span>
              {secret.configured ? (
                <span className="flex items-center gap-2 text-xs text-stone-text">
                  <Badge tone="ok">Cargada</Badge>
                  <span className="font-mono">{secret.hint}</span>
                  {secret.updatedAt && <span>· {dateTime(secret.updatedAt)}</span>}
                </span>
              ) : (
                <Badge tone="warn">Sin cargar</Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="min-w-[16rem] flex-1">
                <span className="sr-only">{secret.label}</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={secret.configured ? "Pegar un valor nuevo para reemplazarla" : "Pegar la credencial"}
                  value={values[secret.key] ?? ""}
                  onChange={(event) => setValues({ ...values, [secret.key]: event.target.value })}
                  className={inputClass}
                />
              </label>
              <Button onClick={() => void save(secret.key)} disabled={busyKey === secret.key || !values[secret.key]?.trim()}>
                {busyKey === secret.key ? "Guardando…" : "Guardar"}
              </Button>
              {secret.configured && (
                <Button variant="danger" onClick={() => void remove(secret.key)} disabled={busyKey === secret.key}>
                  Borrar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
