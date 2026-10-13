/**
 * Importa las fotos originales del estudio a src/assets/photos/ con el recorte de cada lugar.
 * Astro después genera WebP y tamaños responsivos a partir de estos archivos.
 *
 *   node scripts/import-photos.mjs <carpeta-con-originales> [otra-carpeta…]
 *
 * Los originales llegaron en varias tandas (WhatsApp, descargas del feed), así que se puede
 * pasar más de una carpeta: cada foto se busca en todas. Si una no aparece, se avisa y se
 * deja la que ya está en src/assets/photos/.
 *
 * Para cambiar una foto, editá PHOTOS (archivo de origen y recorte) y volvé a correrlo.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirs = process.argv.slice(2);
if (sourceDirs.length === 0) throw new Error("Uso: node scripts/import-photos.mjs <carpeta-con-originales> [otra…]");

/** `crop` en proporciones del original (0–1): recorta antes de guardar. */
const PHOTOS = [
  { out: "hero.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.32 PM.jpeg" },
  // Se recorta la franja inferior: la foto original trae el texto "Pack de 4 clases".
  { out: "classroom.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.33 PM.jpeg", crop: { top: 0, height: 0.86 } },
  { out: "detail.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.34 PM (1).jpeg" },
  { out: "space-1.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.36 PM.jpeg" },
  { out: "space-2.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.35 PM.jpeg" },
  { out: "space-3.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.34 PM.jpeg" },
  // Franja horizontal para el fondo del cierre.
  { out: "closing.jpg", from: "WhatsApp Image 2026-09-25 at 5.40.32 PM.jpeg", crop: { top: 0.3, height: 0.45 } },
  // Segunda tanda: fotos del feed de Instagram que mandó el estudio con el rediseño.
  { out: "arches.jpg", from: "Publicaciones feed - 91.png" },
  { out: "training.jpg", from: "Publicaciones feed - 89.png" },
  { out: "straps.jpg", from: "Publicaciones feed - 90.png" },
  { out: "reformer-detail.jpg", from: "Publicaciones feed - 92.png" },
  { out: "strap-pull.jpg", from: "Publicaciones feed - 88.png" },
  // Collage de Buenos Aires del mockup: fondo del panel "The Experience".
  { out: "buenos-aires.jpg", from: "collage-buenos-aires.png" },
];

mkdirSync(join(root, "src/assets/photos"), { recursive: true });

for (const photo of PHOTOS) {
  const source = sourceDirs.map((dir) => join(dir, photo.from)).find((path) => existsSync(path));
  if (!source) {
    console.warn(`${photo.out.padEnd(20)} se saltea: no está "${photo.from}" en las carpetas indicadas`);
    continue;
  }
  const input = sharp(source).rotate();
  const { width = 0, height = 0 } = await input.metadata();
  const pipeline = photo.crop
    ? input.extract({
        left: 0,
        top: Math.round(height * photo.crop.top),
        width,
        height: Math.round(height * photo.crop.height),
      })
    : input;
  const info = await pipeline
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(root, "src/assets/photos", photo.out));
  console.log(`${photo.out.padEnd(20)} ${info.width}×${info.height}  ← ${photo.from}`);
}
