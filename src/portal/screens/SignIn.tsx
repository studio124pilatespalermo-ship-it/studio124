import { useState } from "react";
import { api } from "../../client/lib/api";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { Button, ErrorNote, Field, inputClass } from "../../client/components/ui";

/** Motivos por los que Google puede devolver al cliente sin dejarlo entrar. */
const REASONS: Record<string, string> = {
  no_account:
    "Tu cuenta de Google no figura entre los clientes del estudio. Escribinos y te damos de alta.",
  state: "La sesión de ingreso venció. Probá de nuevo.",
  cancelled: "Cancelaste el ingreso con Google.",
  google: "Google no pudo confirmar tu identidad. Probá de nuevo en un momento.",
  not_configured: "El ingreso con Google todavía no está habilitado. Escribinos y reservamos tu clase.",
};

/** El ingreso de prueba sólo existe mientras se desarrolla en la máquina propia. */
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export function SignIn({ apiBase }: { apiBase: string }) {
  const status = useAsync(() => api.get<{ available: boolean }>("/auth/google/status"));
  const reason = new URLSearchParams(window.location.search).get("error");
  const available = status.data?.available === true;

  return (
    <div className="grid min-h-screen place-items-center bg-sand px-5">
      <div className="w-full max-w-sm rounded-2xl border border-stone/40 bg-bone p-7 text-center">
        <h1 className="font-serif text-3xl">Studio124</h1>
        <p className="mt-1 text-sm text-stone-text">Tus clases y tus reservas</p>

        {reason && (
          <div className="mt-5 text-left">
            <ErrorNote>{REASONS[reason] ?? "No pudimos iniciar tu sesión. Probá de nuevo."}</ErrorNote>
          </div>
        )}

        {status.loading && <p className="mt-6 text-sm text-stone-text">Cargando…</p>}

        {!status.loading && available && (
          <a
            href={`${apiBase}/api/auth/google/start`}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-ink px-5 text-sm font-semibold text-bone transition-colors hover:bg-ink/90"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.3-.2-1.9H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
              <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
              <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
            </svg>
            Ingresar con Google
          </a>
        )}

        {!status.loading && !available && (
          <p className="mt-6 rounded-xl bg-sand px-4 py-3 text-sm text-stone-text">
            El ingreso online todavía no está habilitado. Escribinos y reservamos tu clase.
          </p>
        )}

        <p className="mt-6 text-xs text-stone-text">
          Usamos tu cuenta de Google sólo para identificarte. No publicamos nada ni accedemos a tus contactos.
        </p>

        {IS_LOCAL && <DevLogin />}
      </div>
    </div>
  );
}

/** Atajo para probar el portal en local sin configurar Google. No existe en producción. */
function DevLogin() {
  const [email, setEmail] = useState("ana@ejemplo.test");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/client/dev-login", { email });
      window.location.reload();
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-dashed border-stone/50 bg-sand/60 p-4 text-left">
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase text-stone-text">Sólo en desarrollo</p>
      <div className="mt-2 flex items-end gap-2">
        <Field label="Email del cliente">
          <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </Field>
        <Button onClick={() => void enter()} disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
