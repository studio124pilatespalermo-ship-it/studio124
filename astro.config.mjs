// @ts-check
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import placeholderReport from "./integrations/placeholder-report.mjs";

const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");

/**
 * La URL pública del sitio define canonical, hreflang, Open Graph y sitemap.
 * Orden: PUBLIC_SITE_URL explícita → dominio de producción que expone Vercel.
 * Sin ninguna de las dos el build falla: una canonical equivocada es peor que un build roto.
 */
function resolveSiteUrl() {
  if (env.PUBLIC_SITE_URL) return env.PUBLIC_SITE_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  throw new Error(
    "Falta PUBLIC_SITE_URL (ej. https://visitors.studio124.com.ar). Copiá .env.example a .env o configurala en Vercel.",
  );
}

export default defineConfig({
  site: resolveSiteUrl(),
  trailingSlash: "always",
  build: { format: "directory" },
  env: {
    schema: {
      // Validado al compilar: si falta o no es una URL, `astro build` y `astro dev` fallan.
      PUBLIC_BOOKING_URL: envField.string({ context: "client", access: "public", url: true }),
    },
    validateSecrets: true,
  },
  image: {
    layout: "constrained",
    responsiveStyles: false,
  },
  integrations: [
    sitemap({
      // La raíz sólo redirige por idioma; no es una página indexable.
      filter: (page) => /\/(en|pt|es)\/$/.test(page),
      i18n: {
        defaultLocale: "en",
        locales: { en: "en", pt: "pt-BR", es: "es" },
      },
    }),
    placeholderReport(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
