/**
 * Vectoriza el logo (PNG con transparencia) en dos capas de color: la figura gris y
 * el texto "Std. 124" crema. El SVG resultante permite cambiar el color del texto
 * según el fondo (crema sobre foto, tinta sobre fondo claro) sin redibujar el logo.
 *
 *   node scripts/trace-logo.mjs [ruta/al/logo.png]
 *
 * Escribe src/components/brand/logo-paths.ts, public/logo.png y public/apple-touch-icon.png.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import potrace from "potrace";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2] ?? join(root, "src/assets/brand/logo-original.png");

// Colores del original, medidos sobre el PNG.
const CREAM = [251, 249, 236];
const GRAY = [194, 193, 185];
const MARGIN = 12;

const distance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

async function readPixels() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function contentBox({ data, width, height }) {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 20) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const left = Math.max(0, minX - MARGIN), top = Math.max(0, minY - MARGIN);
  return { left, top, width: Math.min(width, maxX + MARGIN) - left, height: Math.min(height, maxY + MARGIN) - top };
}

/** Separa cada píxel opaco en la capa cuyo color está más cerca (255 = tinta). */
function classify({ data, width, height }) {
  const type = new Uint8Array(width * height);
  const figure = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] < 128) continue;
    const rgb = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    if (distance(rgb, CREAM) < distance(rgb, GRAY)) type[i] = 255;
    else figure[i] = 255;
  }
  return { type, figure };
}

function hasNeighbor(mask, width, height, x, y, reach) {
  for (let ny = Math.max(0, y - reach); ny <= Math.min(height - 1, y + reach); ny++) {
    for (let nx = Math.max(0, x - reach); nx <= Math.min(width - 1, x + reach); nx++) {
      if (mask[ny * width + nx]) return true;
    }
  }
  return false;
}

/**
 * La figura se extiende unos píxeles por debajo del texto: el texto la tapa y así
 * no aparece una línea de fondo entre las dos capas por el antialiasing.
 */
function growUnder(figure, type, width, height) {
  const grown = figure.slice();
  for (let i = 0; i < figure.length; i++) {
    if (type[i] && !figure[i] && hasNeighbor(figure, width, height, i % width, Math.floor(i / width), 4)) grown[i] = 255;
  }
  return grown;
}

function masks(image) {
  const { type, figure } = classify(image);
  return { type, figure: growUnder(figure, type, image.width, image.height) };
}

async function tracePath(mask, width, height) {
  // potrace espera formas oscuras sobre fondo claro.
  const pixels = Buffer.alloc(width * height);
  for (let i = 0; i < mask.length; i++) pixels[i] = mask[i] ? 0 : 255;
  const png = await sharp(pixels, { raw: { width, height, channels: 1 } }).png().toBuffer();
  const svg = await new Promise((resolve, reject) =>
    potrace.trace(png, { turdSize: 4, optTolerance: 0.3, threshold: 128 }, (err, out) => (err ? reject(err) : resolve(out))),
  );
  const match = svg.match(/ d="([^"]+)"/);
  if (!match) throw new Error("potrace no devolvió un path");
  return match[1].replace(/\s+/g, " ").trim();
}

const pixels = await readPixels();
const box = contentBox(pixels);
const cropped = await sharp(source).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const layers = masks({ data: cropped.data, width: box.width, height: box.height });
const figurePath = await tracePath(layers.figure, box.width, box.height);
const typePath = await tracePath(layers.type, box.width, box.height);

writeFileSync(
  join(root, "src/components/brand/logo-paths.ts"),
  `// Archivo generado por scripts/trace-logo.mjs a partir del logo original. No editar a mano.\n` +
    `export const LOGO_VIEWBOX = "0 0 ${box.width} ${box.height}";\n` +
    `export const LOGO_FIGURE_PATH =\n  "${figurePath}";\n` +
    `export const LOGO_TYPE_PATH =\n  "${typePath}";\n`,
);

// Versión raster recortada: para el JSON-LD (los buscadores prefieren PNG) y el ícono de iOS.
await sharp(source).extract(box).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(root, "public/logo.png"));
const touchLogo = await sharp(source).extract(box).resize(136, 136, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#1f1d1b" } })
  .composite([{ input: touchLogo, gravity: "center" }])
  .png()
  .toFile(join(root, "public/apple-touch-icon.png"));

// Favicon: el logo en sus colores originales sobre tinta.
const inset = Math.round(box.width * 0.08);
const side = box.width + inset * 2;
writeFileSync(
  join(root, "public/favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-inset} ${-inset} ${side} ${side}">` +
    `<rect x="${-inset}" y="${-inset}" width="${side}" height="${side}" rx="${Math.round(side * 0.18)}" fill="#1f1d1b"/>` +
    `<path d="${figurePath}" fill="#c2c1b9"/><path d="${typePath}" fill="#fbf9ec"/></svg>\n`,
);

console.log(`viewBox ${box.width}×${box.height} · figura ${figurePath.length} car. · texto ${typePath.length} car.`);
