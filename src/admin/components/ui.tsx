import type { ReactNode } from "react";

/** Piezas visuales del panel. Mismos tokens que la landing: arena, tinta y terracota. */

export function Button({
  children,
  variant = "primary",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-ink text-bone hover:bg-ink/90",
    ghost: "border border-stone/50 text-ink hover:bg-sand",
    danger: "border border-terracotta-deep text-terracotta-deep hover:bg-terracotta/10",
  } as const;
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[0.6875rem] font-semibold tracking-[0.14em] uppercase text-stone-text">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs text-stone-text">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-terracotta-deep">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-stone/50 bg-bone px-3 py-2 text-sm text-ink outline-none focus-visible:border-ink";

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone/40 bg-bone p-5 md:p-6">
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="font-serif text-2xl">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "bad"; children: ReactNode }) {
  const tones = {
    neutral: "bg-sand text-stone-text",
    ok: "bg-olive/15 text-olive",
    warn: "bg-terracotta/15 text-terracotta-deep",
    bad: "bg-terracotta-deep/15 text-terracotta-deep",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone/50 px-4 py-8 text-center text-sm text-stone-text">{children}</p>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-terracotta-deep/40 bg-terracotta/10 px-3 py-2 text-sm text-terracotta-deep">
      {children}
    </p>
  );
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-stone-text">{label}</p>;
}
