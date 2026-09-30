# Arquitectura

## Decisión: monolito Astro estático

Una sola aplicación pública, sin estado de usuario ni datos propios: el registro y el pago viven en la app
de reservas externa. Por eso Astro en modo estático, sin framework de UI, sin adaptador de servidor y sin
islas. Hay sólo dos scripts, ambos en `public/` y sin dependencias:

- `lang-redirect.js`: respaldo de la redirección por idioma en la raíz (en Vercel la hace el servidor con `vercel.json`).
- `hero-video.js`: botón de pausa del video de fondo (WCAG 2.2.2) y quitar el video con `prefers-reduced-motion`.
  El video arranca solo sin JavaScript; el script sólo suma accesibilidad.

## Límites

| Capa | Responsabilidad | No hace |
| --- | --- | --- |
| `src/content/studio.ts` | Datos variables tipados | No conoce idiomas ni componentes |
| `src/i18n/*.json` | Todo el texto visible | No contiene datos del estudio (usa `{variables}`) |
| `src/lib/` | Funciones puras: formato, placeholders, URLs, JSON-LD | No importa Astro ni variables de entorno |
| `src/components/` | Presentación, una sección por archivo | No arma datos: recibe el diccionario y lee `studio` |
| `src/layouts/BaseLayout.astro` | `<head>` y SEO | No renderiza contenido de la landing |

`lib/` no depende de Astro, así que se testea con Vitest sin levantar nada.

## Datos pendientes

Un valor `{{ASI}}` o `null` es un dato pendiente. Se muestra resaltado en la página (componente `Text`),
se omite del JSON-LD de LocalBusiness para no publicar datos falsos como reales, y
`integrations/placeholder-report.mjs` lo lista al terminar el build. Con `STRICT_PLACEHOLDERS=true`
el build falla.

## Entorno

- `PUBLIC_BOOKING_URL`: validada con `env.schema` de Astro (obligatoria, formato URL).
- `PUBLIC_SITE_URL`: resuelta en `astro.config.mjs`; si falta, usa `VERCEL_PROJECT_PRODUCTION_URL`;
  sin ninguna de las dos el build falla (una canonical equivocada es peor que un build roto).

## SEO

- Canonical por idioma, hreflang recíprocos (`en`, `pt-BR`, `es`) y `x-default` → `/en/`.
- `@astrojs/sitemap` con alternates por idioma; la raíz queda fuera (`noindex`, sólo redirige).
- JSON-LD `ExerciseGym` + `FAQPage` en un `@graph`. El FAQ usa exactamente los mismos textos que el acordeón.

## Accesibilidad

- Un `h1` por página, jerarquía de títulos por sección, skip link, `lang` por idioma y en cada link del selector.
- Foco visible propio (`:focus-visible`) con variante clara sobre fotos (`.on-dark`).
- Contraste AA verificado; ver comentario de tokens en `src/styles/global.css`.
- `prefers-reduced-motion` desactiva transiciones y scroll suave.
- FAQ con `details/summary` nativo: funciona con teclado sin JavaScript.
