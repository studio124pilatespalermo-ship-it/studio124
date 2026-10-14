# Studio124 · Landing para visitantes

Landing de **Studio124**, estudio boutique de Pilates Reformer en Palermo Soho, Buenos Aires.
Un visitante extranjero, desde el celular, entiende la propuesta en su idioma, ve los horarios y reserva en
**SigueFit**, donde se registra, ve el precio, elige el día y paga.

## Alcance de esta versión

- **Se publica sólo la landing.** No hay backend, ni base de datos, ni panel, ni portal de clientes.
- Tres idiomas con ruta propia: `/en/`, `/pt/`, `/es/`. La raíz `/` redirige según el idioma del navegador.
- **Clase única:** todos los botones de reserva llevan a SigueFit (`PUBLIC_BOOKING_URL`) y abren en pestaña nueva.
  El precio no se muestra en la landing: se ve dentro de SigueFit.
- **Membresías y packs:** no se venden online. Los botones abren WhatsApp con un mensaje ya escrito en el idioma
  de la página. No se muestran precios de membresías: se consultan por WhatsApp.
- El sistema de reservas propio (API, panel `/admin` y portal `/cuenta`) está guardado en la rama
  **`sistema-reservas`**, intacto, para retomarlo más adelante. Esta rama no lo incluye y el build **falla** si
  alguna ruta o link hacia él se cuela (ver `integrations/landing-guard.mjs`).

## Requisitos

- Node.js **22.12 o superior** y npm.

## Cómo correrlo

```bash
npm install
cp .env.example .env
npm run dev
```

Abrí http://localhost:4321/.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` (falla si falta `PUBLIC_BOOKING_URL`) |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | ESLint con cero warnings (80 líneas por función, 400 por archivo) |
| `npm run typecheck` | TypeScript estricto sobre `.ts` y `.astro` |
| `npm run test` | Tests: textos en los 3 idiomas, formatos, JSON-LD, política de seguridad, filtración de secretos |
| `npm run verify` | Todo lo anterior, en orden: lint → typecheck → test → build |
| `npm run photos:import -- <carpeta>` | Importa y recorta las fotos originales (ver `scripts/import-photos.mjs`) |
| `npm run logo:trace` | Vectoriza el logo y regenera favicon, `logo.png` y el ícono de iOS |
| `npm run og:generate` | Regenera la imagen para compartir (`public/og-image.jpg`) |

## Qué se cambia y dónde

### Horarios y datos del estudio: `src/content/studio.ts`

```ts
classDurationMinutes: 50,
classSchedule: [ /* grupos de días con los mismos horarios */ ],
openingHours:  [ /* horario de atención del pie y de los datos estructurados */ ],
whatsappNumber: "5491168309759",
```

TypeScript valida el formato: una hora mal escrita o un día inexistente no compila.

### Link de reserva (SigueFit): variable `PUBLIC_BOOKING_URL`

Debería ser el link directo de la **clase única** en SigueFit. Se valida al compilar: si falta o no es una URL, el
build falla.

- **Local:** editá `.env`.
- **Vercel:** Project Settings → Environment Variables → `PUBLIC_BOOKING_URL` (en **Production** y en **Preview**)
  y volvé a desplegar: el valor se inserta en el HTML al compilar.

### Textos y traducciones: `src/i18n/{es,en,pt}.json`

Ningún componente tiene texto propio. Si agregás una clave en un idioma y no en los otros, fallan el typecheck y
los tests. Dos claves a tener presentes:

- `cta.bookShort`: texto de los botones de reserva ("Reservar clase" / "Book a class" / "Reservar aula").
- `membership.whatsappMessage`: mensaje que se abre ya escrito en WhatsApp al consultar por membresías.

## Fotos, videos y logo

Todo vive en el repositorio: al compilar, Astro convierte las fotos a WebP en varios tamaños. No hace falta un
servicio externo. Para **reemplazar una imagen**, pisá el archivo con el mismo nombre (o editá la tabla de
`scripts/import-photos.mjs`). Si la foto nueva muestra otra cosa, actualizá su texto alternativo en `photos` de los
tres archivos de `src/i18n/`.

| Archivo | Dónde aparece | Tamaño ideal |
| --- | --- | --- |
| `src/assets/photos/hero.jpg` | Portada: se ve mientras carga el video y si se pide reducir movimiento | 2560×1440 (zona segura en el 25 % central) |
| `public/video/studio.mp4` | Portada: video de fondo (`heroVideoUrl` en `src/content/media.ts`) | MP4 H.264, 8–10 s, sin audio, < 3 MB |
| `public/video/espacio.mp4` + `espacio-poster.jpg` | "Nuestro espacio": video del medio (`spaceVideoUrl` y `spaceVideoPoster` en `media.ts`) | vertical 720×1280, 10–20 s, < 6 MB |
| `src/assets/photos/arches.jpg`, `space-1.jpg`, `reformer-detail.jpg` | "Nuestro espacio": las tres fotos (en ese orden: izquierda, `space-1` como respaldo del medio, derecha) | 1000×1400 (5:7) |
| `src/assets/photos/reformer-detail.jpg` | También es el fondo de "Nuestros horarios" | 2400×1200 |
| `src/assets/photos/training.jpg` | "Studio124 es tu lugar…" | 1200×1200 |
| `src/assets/photos/straps.jpg` | "Pilates Reformer" | 1200×1200 |
| `src/assets/photos/buenos-aires.jpg` | Fondo de "The Experience" (collage) | 2400×1200 |
| `src/assets/map.png` | Mapa de "The Experience" (calles en blanco, fondo transparente) | ~1000×1000 |
| `src/assets/photos/strap-pull.jpg` | Fondo del pie | 2400×1200 |
| `public/og-image.jpg` | Vista previa al compartir el link | 1200×630 (`npm run og:generate`) |

El registro de qué foto va en cada lugar está en `src/content/photos.ts`.

**Las fotos y los videos actuales son provisorios**: la clienta trae los definitivos. Cuando lleguen, se
reemplazan los archivos de la tabla con el mismo nombre; no hay que tocar código.

El logo original está en `src/assets/brand/logo-original.png`; `npm run logo:trace` lo vectoriza y regenera
`logo-paths.ts`, el favicon y los íconos.

## Diseño y tipografía

Paleta, tipografías y componentes base: `src/styles/global.css` (colores del manual de marca, con el contraste
medido en los comentarios). La tipografía de marca, **Cocomat Pro**, es comercial: hoy se usa **Quicksand** (libre,
la más parecida) y **Pinyon Script** para los títulos caligráficos. Para cambiar a Cocomat cuando esté la licencia
web, seguí `src/assets/fonts/README.md`.

## Deploy en Vercel

El proyecto de Vercel está conectado a este repositorio. Variables de entorno:

- `PUBLIC_BOOKING_URL`: link de reserva de la clase única (SigueFit).
- `PUBLIC_SITE_URL`: dominio final (ej. `https://studio124.com.ar`). Si queda vacía se usa el dominio de Vercel.
- `STRICT_PLACEHOLDERS=true`: **sólo** cuando estén todos los datos; con eso el build falla si queda algún `{{PENDIENTE}}`.

`vercel.json` incluye la redirección de `/` por idioma, barra final en las URLs, headers de seguridad (CSP que
no permite conectarse a ningún dominio externo, HSTS, etc.) y caché larga para los assets con hash.

Controles automáticos que corren en cada build y hacen **fallar el deploy**:

- `integrations/csp-guard.mjs`: ningún script en línea (la CSP lo bloquearía en producción).
- `integrations/landing-guard.mjs`: ninguna página, link ni entrada de sitemap hacia `/admin` o `/cuenta`.
- `tests/secrets.test.ts`: nada con forma de clave o credencial entre lo que git publica.

## Seguridad y privacidad

- Las claves y credenciales **no** van al repositorio: `.env` y similares están en `.gitignore` y un test falla si
  algo con forma de clave se cuela.
- El repositorio debería ser **privado** (GitHub → Settings → Danger Zone → Change visibility).
- Las variables `PUBLIC_*` terminan dentro del HTML del sitio: son públicas por diseño, no guardes secretos ahí.

## Estructura

```text
src/
  content/studio.ts     datos variables del estudio (precio, horarios, dirección, redes, WhatsApp)
  content/photos.ts     registro de fotos
  content/media.ts      videos del sitio
  i18n/                 textos en/pt/es y configuración de idiomas
  lib/                  formato, placeholders, URLs/hreflang/WhatsApp, JSON-LD
  components/           una sección por archivo, en el orden de la página
  components/ui/        botones, links externos, contenedor, fotos
  layouts/BaseLayout    <head>: SEO, hreflang, Open Graph, JSON-LD, fuentes
  pages/[lang]/         la landing, generada para cada idioma
  pages/index.astro     raíz: detección de idioma
integrations/           reporte de placeholders y controles de build
scripts/                importación de fotos, logo, imagen para compartir
tests/                  Vitest
```

## Pendientes

El build lista al final los `{{PENDIENTES}}` que quedan en el HTML; en la página se ven resaltados.

- Link de la clase única en SigueFit → `PUBLIC_BOOKING_URL` (hoy apunta a la página general de SigueFit).
- Fotos y video definitivos de la clienta (ver tabla de arriba).
- Licencia web de Cocomat Pro (opcional).
