# Studio124 · Landing para visitantes

Landing para turistas de **Studio124**, estudio boutique de Pilates Reformer en Palermo Soho, Buenos Aires.
El objetivo es uno solo: que un visitante extranjero, desde el celular, entienda la propuesta en su idioma,
vea precio y horarios y llegue a reservar y pagar en la app externa, sin escribir por WhatsApp.

- Tres idiomas con ruta propia: `/en/`, `/pt/`, `/es/`. La raíz `/` redirige según el idioma del navegador (si no lo reconoce, va a `/en/`).
- Sitio 100 % estático (Astro + Tailwind). Las páginas de idioma no cargan JavaScript.
- Sin backend, sin base de datos, sin formularios: el registro y el pago ocurren en la app de reservas.

## Requisitos

- Node.js **22.12 o superior**
- npm

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
| `npm run lint` | ESLint con cero warnings permitidos (incluye 80 líneas por función y 400 por archivo) |
| `npm run typecheck` | TypeScript estricto sobre `.ts` y `.astro` |
| `npm run test` | Tests: paridad de claves entre idiomas, formato de precio, JSON-LD |
| `npm run verify` | Todo lo anterior, en orden: lint → typecheck → test → build |
| `npm run photos:import -- <carpeta>` | Importa y recorta las fotos originales del estudio (ver `scripts/import-photos.mjs`) |
| `npm run logo:trace` | Vectoriza el logo, y regenera favicon, `logo.png` y el ícono de iOS |
| `npm run og:generate` | Regenera la imagen para compartir (`public/og-image.jpg`) |
| `npm run placeholders:images` | Genera placeholders sólo para las imágenes que falten (hoy, el mapa) |

## Cómo cambiar precio y horarios

Todo dato variable vive en **`src/content/studio.ts`**. No hace falta tocar componentes.

```ts
// Precio de la clase única, en unidades menores (centavos). null = pendiente.
dropInPrice: { amountMinor: 2_500_000, currency: "ARS" },   // → ARS 25,000

classDurationMinutes: 50,
maxPeoplePerClass: 6,
minimumAge: 16,
rescheduleNoticeHours: 12,

// Horarios de clase: grupos de días consecutivos con los mismos horarios.
classSchedule: [
  { days: ["mon", "tue", "wed", "thu", "fri"], times: ["08:00", "09:00", "18:00", "19:00"] },
  { days: ["sat"], times: ["09:00", "10:00"] },
],

// Horario de atención (footer y datos estructurados).
openingHours: [
  { days: ["mon", "tue", "wed", "thu", "fri"], opens: "07:30", closes: "21:00" },
],
```

- El precio se formatea solo según el idioma de la página (`ARS 25,000` / `ARS 25.000`).
- Los nombres de los días salen de los archivos de traducción, así que la grilla se traduce sola.
- Dirección, redes, link de Google Maps, reseñas y número de WhatsApp están en el mismo archivo.
- Los lugares de "Todo está cerca" enlazan a Google Maps desde `nearbyPlaces`: cada uno es un texto de búsqueda
  (ej. `"Plaza Armenia, Palermo, Buenos Aires"`) o, si preferís, el link exacto de la ficha
  (el de "Compartir" en Google Maps). El `id` tiene que coincidir con el de `nearby.places` en `src/i18n/`.
- TypeScript valida el formato: una hora mal escrita o un día inexistente no compila.

## Cómo cambiar el link de reserva

El link sale de la variable de entorno **`PUBLIC_BOOKING_URL`** (valor actual: `https://webapp.siguefit.com/`).
Se valida al compilar: si falta o no es una URL, el build falla.

- **Local:** editá `.env`.
- **Vercel:** Project Settings → Environment Variables → `PUBLIC_BOOKING_URL`, y hacé un redeploy.
  El valor se inserta en el HTML al compilar, así que un cambio de variable necesita un deploy nuevo.

## Textos y traducciones

Todo el texto visible está en `src/i18n/en.json`, `pt.json` y `es.json`. Ningún componente tiene texto propio.

- `{max}`, `{minutes}`, `{hours}`, `{age}` se completan con los valores de `studio.ts`.
- Si agregás una clave en un idioma y no en los otros, fallan el typecheck y los tests.
- Inglés usa "drop-in class"; portugués es de Brasil ("aula avulsa"); español usa voseo porteño.

## Fotos, logo y video

Todo vive en el repositorio: al compilar, Astro convierte las fotos a WebP en varios tamaños y Vercel
las sirve desde su CDN junto con el sitio. No hace falta un servicio externo de imágenes.

### Fotos

Para cambiar una foto, reemplazá el archivo con el mismo nombre, o editá la tabla de
`scripts/import-photos.mjs` (archivo de origen y recorte) y corré `npm run photos:import -- <carpeta>`.

| Archivo | Dónde aparece | Foto actual |
| --- | --- | --- |
| `src/assets/photos/hero.jpg` | Hero (se ve mientras carga el video, y si el usuario pidió reducir movimiento) | Puente sobre el reformer |
| `src/assets/photos/classroom.jpg` | Intro, marco en arco | Reformers con plantas (recortada: la original tenía el texto "Pack de 4 clases") |
| `src/assets/photos/detail.jpg` | Precio, arco de esquina | Pie en el reformer, espejos en arco |
| `src/assets/photos/space-1.jpg` … `space-3.jpg` | Galería "El espacio" | Sala con sillón · Clase desde la recepción · Aro de Pilates |
| `src/assets/photos/pillar-palermo.jpg` | Tarjeta "Palermo Soho" | Calle con arcos de ladrillo y bicicleta (imagen generada con IA) |
| `src/assets/photos/pillar-visitors.jpg` | Tarjeta "Visitors welcome" | Turistas y tango (imagen generada con IA, es La Boca) |
| — | Tarjeta "Boutique Pilates Studio" | Reusa `hero.jpg` |
| `src/assets/photos/closing.jpg` | Fondo del cierre (decorativa) | Franja horizontal de la foto del hero |
| `src/assets/map.jpg` | Mapa estático | **Placeholder**: una captura de Google Maps recortada a 1200 × 800 |
| `public/og-image.jpg` | Vista previa al compartir el link | Generada con `npm run og:generate` |

Si una foto nueva muestra otra cosa, actualizá su texto alternativo en `photos` de los tres archivos de `src/i18n/`.
Las fotos actuales llegaron por WhatsApp (1200 px de ancho, comprimidas): los originales del celular se verían más nítidos en desktop.

### Logo

El original está en `src/assets/brand/logo-original.png`. `npm run logo:trace` lo vectoriza en dos capas
(figura gris y texto crema) y genera `src/components/brand/logo-paths.ts`, el favicon, `public/logo.png`
(para los datos estructurados) y `public/apple-touch-icon.png`.

El componente `Logo` tiene dos variantes: `on-dark` (colores originales, sobre el video del hero) y
`on-light` (texto en tinta, en el footer), porque el crema original no se ve sobre fondos claros.

### Video del hero

Loop de fondo sin sonido, tipo GIF. El archivo es `public/video/studio.mp4` y se configura en `src/content/media.ts`
(`null` = sólo foto). Recomendado: vertical 9:16, 720 × 1280, 6–10 s, sin audio, MP4 H.264, 1,5–3 MB.

- Arranca solo (`autoplay`, `loop`, `muted`, `playsinline`). La foto del hero queda debajo mientras carga.
- Tiene un botón de pausa (WCAG 2.2.2 exige poder detener una animación de más de 5 s).
- Con "reducir movimiento" activado en el sistema, el video no se muestra y queda la foto.

## Diseño

Los tokens (colores, tipografías, arco) están al principio de `src/styles/global.css`.
El terracota (`--color-terracotta`) se usa sólo en el botón de reserva.

## Deploy en Vercel

Todavía no está deployado. Cuando esté la cuenta del cliente:

1. Subí este proyecto a su propio repositorio de Git (hoy vive dentro de otra carpeta con repo propio).
2. En Vercel: Add New → Project → importá el repo. El framework (Astro) se detecta solo.
3. Cargá las variables de entorno:
   - `PUBLIC_BOOKING_URL` = `https://webapp.siguefit.com/`
   - `PUBLIC_SITE_URL` = el dominio final (ej. `https://visitors.studio124.com.ar`). Si queda vacía, se usa el dominio de producción de Vercel.
   - `STRICT_PLACEHOLDERS` = `true` **sólo** cuando estén todos los datos: con esa variable el build falla si queda algún `{{PENDIENTE}}`.
4. Deploy.

`vercel.json` ya incluye: redirección de `/` por idioma (`Accept-Language`) en el servidor, barra final en las URLs,
headers de seguridad (CSP, HSTS, etc.) y caché larga para los assets con hash.

## Estructura

```text
src/
  content/studio.ts     datos variables del estudio (precio, horarios, dirección, redes)
  content/photos.ts     registro de fotos
  i18n/                 textos en/pt/es y configuración de idiomas
  lib/                  formato, placeholders, URLs/hreflang, JSON-LD
  components/           una sección por archivo, en el orden de la página
  components/ui/        botón de reserva, links externos, contenedor, separador
  layouts/BaseLayout    <head>: SEO, hreflang, Open Graph, JSON-LD, fuentes
  pages/[lang]/         la landing, generada para cada idioma
  pages/index.astro     raíz: detección de idioma
  pages/robots.txt.ts   robots.txt con la URL del sitemap
integrations/           reporte de placeholders al terminar el build
scripts/                generador de imágenes placeholder
tests/                  Vitest
```

Más detalle en [docs/architecture.md](docs/architecture.md).

## Pendientes de completar

El build lista al final todos los `{{PENDIENTES}}` que quedan en el HTML. En la página se ven resaltados.

### Datos (en `src/content/studio.ts`)

| Placeholder | Dato |
| --- | --- |
| `{{PRECIO}}` | Precio de la clase única → `dropInPrice.amountMinor` (y confirmar moneda: hoy `ARS`) |
| `{{DURACION}}` | Duración de la clase en minutos → `classDurationMinutes` |
| `{{HORAS_AVISO}}` | Anticipación para reprogramar, en horas → `rescheduleNoticeHours` |
| `{{FACEBOOK_URL}}` | Link a la página de Facebook |
| `{{GOOGLE_RESENAS_URL}}` | Link a las reseñas de Google |

### Assets

- **Video final del hero**: el actual (`public/video/studio.mp4`) es provisorio. Dura 18 s y vino de WhatsApp en 464 × 832,
  poca resolución para el celular. Falta el recorte definitivo (sugerido: del segundo 4 al 12) exportado desde el original.
- **Mapa estático** (`src/assets/map.jpg`).
- Opcional: los originales de las fotos en mayor resolución.
- Dominio final → `PUBLIC_SITE_URL`.

### Contenido para validar con el estudio

No son placeholders, pero son suposiciones razonables que el estudio tiene que confirmar:

- Grilla de clases, horario de atención, dirección, WhatsApp, email, Instagram, edad mínima y respuestas
  de FAQ vienen de lo publicado por el estudio. Coordenadas y código postal, de su ficha de Google Maps (25/09/2026).
- FAQ: "¿Sirve si nunca hice Pilates?" y la política de cancelación (reprogramar sí, reembolso no) salen del
  brief, no del sitio del estudio; y "avisanos antes de empezar" en la respuesta sobre lesiones es un agregado.
- Tipo de cada lugar del barrio (Don Julio "Parrilla", Corazón Social "Bar", Distrito Arcos "Compras").
- Si la variante del logo para fondo claro (texto en tinta) está bien, o si el estudio tiene una versión oficial.
- Las respuestas automáticas de WhatsApp que pide el documento se configuran en WhatsApp Business, no en el sitio.
