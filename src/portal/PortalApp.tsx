import { useMemo, useState } from "react";
import { api, API_BASE } from "../client/lib/api";
import { useAsync } from "../client/lib/useAsync";
import {
  detectLocale,
  dictionaryFor,
  fill,
  isPortalLocale,
  LOCALE_LABEL,
  LOCALE_NAME,
  PORTAL_LOCALES,
  PortalLocaleContext,
  usePortalLocale,
  type PortalLocale,
} from "./i18n";
import type { PortalClient, PortalConfig } from "./lib/types";
import { SignIn } from "./screens/SignIn";
import { MyClasses } from "./screens/MyClasses";
import { BookClass } from "./screens/BookClass";
import { BuyPack } from "./screens/BuyPack";

/**
 * Portal del cliente, en los tres idiomas de la landing. El idioma se guarda en la ficha
 * del cliente: lo elige una vez y lo ve igual desde cualquier dispositivo.
 */
type Tab = "classes" | "book" | "pay";

export default function PortalApp() {
  const [tab, setTab] = useState<Tab>("classes");
  const [refreshKey, setRefreshKey] = useState(0);
  const [override, setOverride] = useState<PortalLocale | null>(null);

  const config = useAsync(() => api.get<PortalConfig>("/portal/config"));
  const session = useAsync(
    () => api.get<{ client: PortalClient | null }>("/portal/me").catch(() => ({ client: null })),
    String(refreshKey),
  );

  const client = session.data?.client ?? null;
  // Prioridad: lo que eligió en esta visita → el idioma que traía de la landing →
  // el guardado en su ficha → el del navegador.
  const fromLanding = new URLSearchParams(window.location.search).get("lang");
  const locale: PortalLocale =
    override ??
    (isPortalLocale(fromLanding)
      ? fromLanding
      : isPortalLocale(client?.locale)
        ? client.locale
        : detectLocale());
  const value = useMemo(
    () => ({
      locale,
      t: dictionaryFor(locale),
      setLocale: (next: PortalLocale) => {
        setOverride(next);
        // Si hay sesión, el idioma queda guardado en su ficha; si no, dura la visita.
        if (client) void api.patch("/portal/me", { locale: next }).catch(() => undefined);
      },
    }),
    [locale, client],
  );
  const { t } = value;

  if (config.loading || session.loading) {
    return <p className="py-16 text-center text-sm text-stone-text">{t.common.loading}</p>;
  }

  if (!client || !config.data) {
    return (
      <PortalLocaleContext.Provider value={value}>
        <SignIn apiBase={API_BASE} />
      </PortalLocaleContext.Provider>
    );
  }

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: "classes", label: t.nav.classes, visible: true },
    { id: "book", label: t.nav.book, visible: config.data.showAvailableSlots && config.data.allowBooking },
    { id: "pay", label: t.nav.pay, visible: config.data.showPayments && config.data.allowOnlinePayment },
  ];
  const visibleTabs = tabs.filter((item) => item.visible);
  const active = visibleTabs.some((item) => item.id === tab) ? tab : "classes";

  async function signOut() {
    await api.post("/auth/client/logout").catch(() => undefined);
    setRefreshKey((key) => key + 1);
  }

  return (
    <PortalLocaleContext.Provider value={value}>
      <div className="min-h-screen bg-sand">
        <header className="border-b border-stone/40 bg-bone">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
            <div>
              <p className="font-serif text-2xl">Studio124</p>
              <p className="text-sm text-stone-text">{fill(t.nav.greeting, { name: client.name.split(" ")[0] ?? "" })}</p>
            </div>
            <div className="flex items-center gap-3">
              <LocaleSwitcher />
              <button type="button" onClick={() => void signOut()} className="text-link text-sm">
                {t.nav.signOut}
              </button>
            </div>
          </div>
          {visibleTabs.length > 1 && (
            <nav aria-label={t.nav.sections} className="mx-auto max-w-4xl px-5 md:px-8">
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
          <p className="pt-2 text-center text-xs text-stone-text">{t.common.timezone}</p>
        </main>
      </div>
    </PortalLocaleContext.Provider>
  );
}

function LocaleSwitcher() {
  const { locale, setLocale, t } = usePortalLocale();
  return (
    <nav aria-label={t.nav.language}>
      <ul className="flex items-center text-[0.6875rem] font-semibold tracking-[0.12em]">
        {PORTAL_LOCALES.map((code) => (
          <li key={code}>
            <button
              type="button"
              onClick={() => setLocale(code)}
              aria-current={code === locale ? "true" : undefined}
              className={`inline-flex h-9 items-center px-1.5 transition-opacity ${
                code === locale ? "underline decoration-1 underline-offset-[0.4em]" : "opacity-70 hover:opacity-100"
              }`}
            >
              {LOCALE_LABEL[code]}
              <span className="sr-only"> · {LOCALE_NAME[code]}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
