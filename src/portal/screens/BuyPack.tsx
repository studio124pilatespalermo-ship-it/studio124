import { useState } from "react";
import { api } from "../../client/lib/api";
import { money } from "../../client/lib/format";
import { messageOf, useAsync } from "../../client/lib/useAsync";
import { Button, Card, Empty, ErrorNote, Spinner } from "../../client/components/ui";
import type { PortalCategory } from "../lib/types";

/**
 * Compra de clases. El pago ocurre en Mercado Pago: acá sólo se crea la preferencia y se
 * redirige. Las clases se acreditan cuando Mercado Pago confirma el pago.
 */
export function BuyPack() {
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

  if (state.loading) return <Spinner />;

  const categories = state.data?.categories ?? [];

  return (
    <Card title="Comprar clases">
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}

      {!state.error && categories.length === 0 && (
        <Empty>Todavía no hay paquetes disponibles para comprar online. Escribinos y lo resolvemos.</Empty>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <li key={category.id} className="rounded-xl border border-stone/40 p-5">
            <h3 className="font-serif text-2xl">{category.name}</h3>
            <p className="mt-1 text-sm text-stone-text">
              {category.classes} clase(s) · vigencia de {category.validityDays} días
            </p>
            <p className="mt-3 font-serif text-3xl">{money(category.priceMinor, category.currency)}</p>
            <Button onClick={() => void checkout(category.id)} disabled={busy !== null} className="mt-4 w-full">
              {busy === category.id ? "Abriendo el pago…" : "Pagar con Mercado Pago"}
            </Button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-stone-text">
        El pago se completa en Mercado Pago. Las clases se acreditan apenas se confirma; si tardara, escribinos.
      </p>
    </Card>
  );
}
