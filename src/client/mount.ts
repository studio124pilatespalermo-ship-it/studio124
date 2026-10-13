import { createElement, StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";

/**
 * Monta una app de React (panel o portal) en `#app`.
 *
 * No se usa `client:only` de Astro a propósito: ese modo deja un script de arranque en
 * línea en el HTML, y la CSP de producción (`script-src 'self'`) lo bloquea, así que la
 * app no arrancaba en Vercel aunque en local anduviera. Este módulo lo empaqueta Astro
 * como archivo propio en /_astro, que la CSP sí permite.
 */
export function mount(App: ComponentType): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("Falta el contenedor #app.");
  createRoot(root).render(createElement(StrictMode, null, createElement(App)));
}
