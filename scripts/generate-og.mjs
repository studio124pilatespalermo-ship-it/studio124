/**
 * Genera public/og-image.jpg (1200×630): la vista previa al compartir el link por
 * WhatsApp o redes. Panel tinta con el logo a la izquierda y una foto del estudio a la derecha.
 *
 *   node scripts/generate-og.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1200;
const HEIGHT = 630;
const PANEL = 540;

const photo = await sharp(join(root, "src/assets/photos/classroom.jpg"))
  .resize(WIDTH - PANEL, HEIGHT, { fit: "cover", position: "centre" })
  .toBuffer();
const logo = await sharp(join(root, "public/logo.png")).resize(230, 230).toBuffer();

const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL}" height="${HEIGHT}">
  <text x="72" y="410" font-family="Georgia, serif" font-style="italic" font-size="62" fill="#f6f2ec">Buenos Aires</text>
  <text x="72" y="478" font-family="Georgia, serif" font-style="italic" font-size="62" fill="#f6f2ec">+ Pilates</text>
  <text x="74" y="548" font-family="Segoe UI, Arial, sans-serif" font-size="19" letter-spacing="5" fill="#c2c1b9">PALERMO SOHO · BUENOS AIRES</text>
</svg>`);

await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#1f1d1b" } })
  .composite([
    { input: photo, left: PANEL, top: 0 },
    { input: logo, left: 56, top: 60 },
    { input: text, left: 0, top: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(join(root, "public/og-image.jpg"));

console.log("public/og-image.jpg");
