/**
 * Importa las fotos originales del estudio a src/assets/photos/ con el recorte de cada lugar.
 * Astro después genera WebP y tamaños responsivos a partir de estos archivos.
 *
 *   node scripts/import-photos.mjs <carpeta-con-originales>
 *
 * Para cambiar una foto, editá PHOTOS (archivo de origen y recorte) y volvé a correrlo.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = process.argv[2];
if (!sourceDir) throw new Error("Uso: node scripts/import-photos.mjs <carpeta-con-originales>");

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
];

mkdirSync(join(root, "src/assets/photos"), { recursive: true });

for (const photo of PHOTOS) {
  const input = sharp(join(sourceDir, photo.from)).rotate();
  const { width = 0, height = 0 } = await input.metadata();
  const pipeline = photo.crop
    ? input.extract({
        left: 0,
        top: Math.round(height * photo.crop.top),
        width,
        height: Math.round(height * photo.crop.height),
      })
    : input;
  const info = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toFile(join(root, "src/assets/photos", photo.out));
  console.log(`${photo.out.padEnd(14)} ${info.width}×${info.height}  ← ${photo.from}`);
}
