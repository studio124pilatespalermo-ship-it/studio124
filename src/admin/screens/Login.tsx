import { useState, type SubmitEvent } from "react";
import { api, ApiError } from "../../client/lib/api";
import { Button, ErrorNote, Field, inputClass } from "../../client/components/ui";

export function LoginScreen({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/panel/login", { email, password });
      await onLogin();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sand px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-stone/40 bg-bone p-7">
        <h1 className="font-serif text-3xl">Studio124</h1>
        <p className="mt-1 text-sm text-stone-text">Panel de administración</p>

        <div className="mt-6 space-y-4">
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
