/**
 * Genera imágenes placeholder para las fotos que el estudio todavía no entregó.
 * Nunca pisa un archivo existente: para regenerar uno, borralo primero o usá --force.
 *
 *   npm run placeholders:images
 *   npm run placeholders:images -- --force
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");

// Las fotos ya son reales (scripts/import-photos.mjs). Sólo se regeneran si falta el archivo.
const PHOTOS = [
  { file: "src/assets/photos/hero.jpg", width: 1200, height: 1600, tone: "#9c7e5c" },
  { file: "src/assets/photos/classroom.jpg", width: 1080, height: 1160, tone: "#c9ad88" },
  { file: "src/assets/photos/detail.jpg", width: 1200, height: 1600, tone: "#bfa27c" },
  { file: "src/assets/photos/space-1.jpg", width: 900, height: 1200, tone: "#cbb18e" },
  { file: "src/assets/photos/space-2.jpg", width: 900, height: 1200, tone: "#bda17e" },
  { file: "src/assets/photos/space-3.jpg", width: 900, height: 1200, tone: "#d3bc9c" },
  { file: "src/assets/photos/closing.jpg", width: 1200, height: 720, tone: "#8d7152" },
];

// El rótulo va arriba y chico: en el hero y el cierre el texto de la página ocupa la parte baja.
function label(width, height, title, subtitle) {
  const size = Math.round(Math.min(width, height) / 30);
  return `
    <text x="50%" y="${size * 3}" text-anchor="middle" font-family="Georgia, serif"
      font-size="${size * 1.2}" fill="#f6f2ec" fill-opacity="0.75">${title}</text>
    <text x="50%" y="${size * 4.4}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
      font-size="${size * 0.6}" letter-spacing="${size * 0.1}" fill="#f6f2ec" fill-opacity="0.7">${subtitle}</text>`;
}

function photoSvg({ file, width, height, tone }) {
  const name = file.split("/").pop();
  const archWidth = width * 0.46;
  const archX = (width - archWidth) / 2;
  const archTop = height * 0.16;
  const r = archWidth / 2;
  const archBottom = height * 0.8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${tone}"/>
    <path d="M${archX} ${archBottom} V${archTop + r} A${r} ${r} 0 0 1 ${archX + archWidth} ${archTop + r} V${archBottom} Z"
      fill="#f6f2ec" fill-opacity="0.14" stroke="#f6f2ec" stroke-opacity="0.45" stroke-width="${Math.max(2, width / 500)}"/>
    ${label(width, height, "Foto pendiente", `${name} · ${width}×${height}`)}
  </svg>`;
}

function mapSvg(width, height) {
  const streets = [];
  for (let i = -6; i <= 14; i++) {
    const offset = i * 90;
    streets.push(`<line x1="${offset}" y1="0" x2="${offset + height * 0.55}" y2="${height}" />`);
    streets.push(`<line x1="0" y1="${offset}" x2="${width}" y2="${offset - width * 0.55}" />`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#ece4d9"/>
    <g stroke="#f6f2ec" stroke-width="10">${streets.join("")}</g>
    <circle cx="${width / 2}" cy="${height / 2 - 30}" r="18" fill="#1f1d1b"/>
    <circle cx="${width / 2}" cy="${height / 2 - 30}" r="7" fill="#ece4d9"/>
    <text x="50%" y="${height - 70}" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#1f1d1b">Mapa pendiente</text>
    <text x="50%" y="${height - 36}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#6a635b">map.jpg · captura estática 1200×800</text>
  </svg>`;
}

async function write(file, svg) {
  const target = join(root, file);
  if (existsSync(target) && !force) {
    console.log(`= ${file} (ya existe, no se toca)`);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(target);
  console.log(`+ ${file}`);
}

for (const photo of PHOTOS) await write(photo.file, photoSvg(photo));
await write("src/assets/map.jpg", mapSvg(1200, 800));
