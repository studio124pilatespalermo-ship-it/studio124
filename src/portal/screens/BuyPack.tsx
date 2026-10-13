import { useState } from "react";
import { api } from "../../client/lib/api";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { Button, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";
import { fill, usePortalLocale } from "../i18n";
import { money } from "../lib/dates";
import type { PortalCategory } from "../lib/types";

/**
 * Compra de clases. El pago ocurre en Mercado Pago: acá sólo se crea la preferencia y se
 * redirige. Las clases se acreditan cuando Mercado Pago confirma el pago.
 */
export function BuyPack() {
  const { t, locale } = usePortalLocale();
  const state = useAsync(() => api.get<{ categories: PortalCategory[] }>("/portal/categories"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function checkout(categoryId: string) {
    setBusy(categoryId);
    setError(null);
    try {
      const { initPoint } = await api.post<{ initPoint: string }>("/portal/checkout", { categoryId });
      // Navegación al checkout de Mercado Pago; a partir de acá el flujo sigue allá.
      window.location.assign(initPoint);
    } catch (err) {
      setError(messageOf(err));
      setBusy(null);
    }
  }

  if (state.loading) return <Spinner label={t.common.loading} />;

  const categories = state.data?.categories ?? [];

  return (
    <Card title={t.buy.title}>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}

      {!state.error && categories.length === 0 && <Empty>{t.buy.none}</Empty>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <li key={category.id} className="rounded-xl border border-stone/40 p-5">
            <h3 className="font-semibold text-2xl">{category.name}</h3>
            <p className="mt-1 text-sm text-stone-text">
              {fill(t.buy.detail, { classes: category.classes, days: category.validityDays })}
            </p>
            <p className="mt-3 font-semibold text-3xl">{money(category.priceMinor, category.currency, locale)}</p>
            <Button onClick={() => void checkout(category.id)} disabled={busy !== null} className="mt-4 w-full">
              {busy === category.id ? t.buy.paying : t.buy.pay}
            </Button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-stone-text">{t.buy.note}</p>
    </Card>
  );
}
