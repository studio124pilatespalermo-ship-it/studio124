import type { ReactNode } from "react";

/**
 * Piezas visuales del panel y del portal, con la misma marca que la landing: crema, arena,
 * piedra y grafito, Quicksand y píldoras redondeadas. La terracota es sólo para avisos.
 */

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
    primary: "bg-bubble text-cream hover:bg-ink",
    ghost: "border border-stone text-text hover:bg-sand/60",
    danger: "border border-terracotta-deep text-terracotta-deep hover:bg-terracotta/10",
  } as const;
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${rest.className ?? ""}`}
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
  "w-full rounded-xl border border-stone/60 bg-cream px-3.5 py-2.5 text-sm text-text outline-none focus-visible:border-text focus-visible:ring-2 focus-visible:ring-stone/40";

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-sand bg-cream p-5 md:p-7">
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-2xl font-semibold">{title}</h2>}
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
