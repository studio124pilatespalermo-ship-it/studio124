import { useEffect, useState } from "react";
import { api } from "../client/lib/api";
import { useAsync } from "../client/lib/useAsync";
import type { PanelUser } from "../client/lib/types";
import { LoginScreen } from "./screens/Login";
import { AgendaScreen } from "./screens/Agenda";
import { ClientsScreen } from "./screens/Clients";
import { ClientDetailScreen } from "./screens/ClientDetail";
import { PaymentsScreen } from "./screens/Payments";
import { TemplateScreen } from "./screens/Template";
import { CatalogScreen } from "./screens/Catalog";
import { SettingsScreen } from "./screens/Settings";
import { DashboardScreen } from "./screens/Dashboard";
import { BrandMark } from "../client/components/BrandMark";
import { Spinner } from "../client/components/ui";

/**
 * Panel de administración. Es una SPA chica con rutas por hash, así la landing sigue
 * siendo un sitio estático y /admin no necesita servidor propio.
 */
export type Route =
  | { name: "dashboard" }
  | { name: "agenda" }
  | { name: "clients" }
  | { name: "client"; id: string }
  | { name: "payments" }
  | { name: "template" }
  | { name: "catalog" }
  | { name: "settings" };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split("/");
  switch (path[0]) {
    case "agenda":
      return { name: "agenda" };
    case "clientes":
      return path[1] ? { name: "client", id: path[1] } : { name: "clients" };
    case "pagos":
      return { name: "payments" };
    case "agenda-modelo":
      return { name: "template" };
    case "catalogo":
      return { name: "catalog" };
    case "configuracion":
      return { name: "settings" };
    default:
      return { name: "dashboard" };
  }
}

const NAV = [
  { hash: "#/", label: "Tablero", match: "dashboard" },
  { hash: "#/agenda", label: "Agenda", match: "agenda" },
  { hash: "#/clientes", label: "Clientes", match: "clients" },
  { hash: "#/pagos", label: "Pagos", match: "payments" },
  { hash: "#/agenda-modelo", label: "Agenda modelo", match: "template" },
  { hash: "#/catalogo", label: "Catálogo", match: "catalog" },
  { hash: "#/configuracion", label: "Configuración", match: "settings" },
] as const;

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export default function AdminApp() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  // Si no hay sesión, la API responde 401 y `session.data` queda en null: no es un error a mostrar.
  const session = useAsync(() => api.get<{ user: PanelUser }>("/auth/panel/me").catch(() => ({ user: null })));
  const user = session.data?.user ?? null;

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  async function logout() {
    await api.post("/auth/panel/logout").catch(() => undefined);
    await session.reload();
  }

  if (session.loading) return <Spinner label="Verificando sesión…" />;
  if (!user) return <LoginScreen onLogin={session.reload} />;

  const isAdmin = user.role === "admin";
  const current = NAV.find((item) => item.match === route.name)?.match ?? "dashboard";

  return (
    <div className="min-h-screen bg-sand/50">
      <header className="border-b border-sand bg-cream">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <span className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span className="text-lg font-semibold text-graphite">Panel</span>
          </span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-text">
              {user.name} · {isAdmin ? "Administración" : "Instructora"}
            </span>
            <button type="button" onClick={() => void logout()} className="text-link text-sm">
              Salir
            </button>
          </div>
        </div>
        <nav aria-label="Secciones" className="mx-auto max-w-7xl overflow-x-auto px-4 md:px-8">
          <ul className="flex gap-1 pb-2">
            {NAV.filter((item) => isAdmin || item.match === "agenda" || item.match === "dashboard").map((item) => (
              <li key={item.hash}>
                <a
                  href={item.hash}
                  aria-current={current === item.match ? "page" : undefined}
                  className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors ${
                    current === item.match ? "bg-bubble text-cream" : "text-stone-text hover:bg-sand"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
        {route.name === "dashboard" && <DashboardScreen />}
        {route.name === "agenda" && <AgendaScreen canEdit={isAdmin} />}
        {route.name === "clients" && <ClientsScreen />}
        {route.name === "client" && <ClientDetailScreen clientId={route.id} />}
        {route.name === "payments" && <PaymentsScreen />}
        {route.name === "template" && <TemplateScreen />}
        {route.name === "catalog" && <CatalogScreen />}
        {route.name === "settings" && <SettingsScreen />}
      </main>
    </div>
  );
}
