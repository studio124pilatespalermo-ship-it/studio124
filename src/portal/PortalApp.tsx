import { useState } from "react";
import { api, API_BASE } from "../client/lib/api";
import { useAsync } from "../client/lib/useAsync";
import type { PortalClient, PortalConfig } from "./lib/types";
import { SignIn } from "./screens/SignIn";
import { MyClasses } from "./screens/MyClasses";
import { BookClass } from "./screens/BookClass";
import { BuyPack } from "./screens/BuyPack";

/**
 * Portal del cliente. Igual que el panel, es una aplicación de cliente para que la landing
 * siga siendo estática. El estudio decide desde /admin qué secciones se muestran.
 */
type Tab = "classes" | "book" | "pay";

export default function PortalApp() {
  const [tab, setTab] = useState<Tab>("classes");
  const [refreshKey, setRefreshKey] = useState(0);

  const config = useAsync(() => api.get<PortalConfig>("/portal/config"));
  const session = useAsync(
    () => api.get<{ client: PortalClient | null }>("/portal/me").catch(() => ({ client: null })),
    String(refreshKey),
  );

  if (config.loading || session.loading) {
    return <p className="py-16 text-center text-sm text-stone-text">Cargando…</p>;
  }

  const client = session.data?.client ?? null;
  if (!client || !config.data) {
    return <SignIn apiBase={API_BASE} />;
  }

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "classes", label: "Mis clases", visible: true },
    { id: "book", label: "Reservar", visible: config.data.showAvailableSlots && config.data.allowBooking },
    { id: "pay", label: "Comprar clases", visible: config.data.showPayments && config.data.allowOnlinePayment },
  ];
  const visibleTabs = tabs.filter((item) => item.visible);
  const active = visibleTabs.some((item) => item.id === tab) ? tab : "classes";

  async function signOut() {
    await api.post("/auth/client/logout").catch(() => undefined);
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-stone/40 bg-bone">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <div>
            <p className="font-serif text-2xl">Studio124</p>
            <p className="text-sm text-stone-text">Hola, {client.name.split(" ")[0]}</p>
          </div>
          <button type="button" onClick={() => void signOut()} className="text-link text-sm">
            Salir
          </button>
        </div>
        {visibleTabs.length > 1 && (
          <nav aria-label="Secciones" className="mx-auto max-w-4xl px-5 md:px-8">
            <ul className="flex gap-1 overflow-x-auto pb-3">
              {visibleTabs.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={active === item.id ? "page" : undefined}
                    className={`inline-flex h-10 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors ${
                      active === item.id ? "bg-ink text-bone" : "text-stone-text hover:bg-sand"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-5 py-6 md:px-8">
        {active === "classes" && <MyClasses config={config.data} />}
        {active === "book" && <BookClass config={config.data} />}
        {active === "pay" && <BuyPack />}
        <p className="pt-2 text-center text-xs text-stone-text">{config.data.timezoneNote}</p>
      </main>
    </div>
  );
}
