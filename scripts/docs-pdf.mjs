/**
 * Convierte un documento de docs/ en un PDF A4 listo para imprimir o compartir.
 * Usa Chrome o Edge en modo headless: no hace falta instalar nada más.
 *
 *   npm run docs:pdf -- sistema-reservas
 *   npm run docs:pdf -- sistema-reservas architecture
 *
 * Los PDF quedan en docs/pdf/ y no se versionan (se regeneran del .md).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");
const outDir = join(docsDir, "pdf");

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const STYLES = `
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
body {
  margin: 0; font-family: "Manrope", "Segoe UI", Arial, sans-serif;
  font-size: 10pt; line-height: 1.6; color: #1f1d1b; -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
h1, h2, h3, h4 { font-family: Georgia, "Times New Roman", serif; color: #1f1d1b; line-height: 1.2; }
h1 { font-size: 26pt; margin: 0 0 2mm; letter-spacing: -0.01em; }
h2 { font-size: 15pt; margin: 9mm 0 3mm; padding-bottom: 2mm; border-bottom: 0.8pt solid #d9d2c7; break-after: avoid; }
h3 { font-size: 12pt; margin: 6mm 0 2mm; break-after: avoid; }
p, ul, ol, table { margin: 0 0 3.5mm; }
ul, ol { padding-left: 5mm; }
li { margin-bottom: 1.2mm; }
a { color: #8a4b33; text-decoration: none; }
code { font-family: "Cascadia Mono", Consolas, monospace; font-size: 8.8pt; background: #f1ece3; padding: 0.3mm 1.2mm; border-radius: 1mm; }
pre { background: #1f1d1b; color: #f6f2ec; padding: 4mm 5mm; border-radius: 2mm; overflow-x: auto; break-inside: avoid; }
pre code { background: none; color: inherit; padding: 0; font-size: 8.5pt; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; break-inside: avoid; }
th, td { text-align: left; vertical-align: top; padding: 2mm 3mm; border-bottom: 0.6pt solid #e2dcd2; }
th { background: #ece4d9; font-weight: 700; }
blockquote { margin: 0 0 3.5mm; padding-left: 4mm; border-left: 2pt solid #d9d2c7; color: #6a635b; }
hr { border: 0; border-top: 0.8pt solid #d9d2c7; margin: 8mm 0; }
.cover-meta { color: #6a635b; font-size: 9pt; margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 1.2pt solid #1f1d1b; }
.page-footer { position: fixed; bottom: -13mm; left: 0; right: 0; display: flex; justify-content: space-between;
  font-size: 7.5pt; color: #6a635b; border-top: 0.6pt solid #e2dcd2; padding-top: 3mm; }
`;

function render(name) {
  const source = join(docsDir, `${name}.md`);
  if (!existsSync(source)) throw new Error(`No existe docs/${name}.md`);

  const markdown = readFileSync(source, "utf8");
  const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? name;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>${STYLES}</style></head>
<body>
  <div class="page-footer"><span>Studio124 · ${title}</span><span>${today}</span></div>
  <p class="cover-meta">Studio124 Pilates · documentación técnica · ${today}</p>
  ${marked.parse(markdown)}
</body></html>`;

  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, `${name}.html`);
  const pdfPath = join(outDir, `${name}.pdf`);
  writeFileSync(htmlPath, html);

  const browser = BROWSERS.find((path) => existsSync(path));
  if (!browser) throw new Error("No encontré Chrome ni Edge para generar el PDF.");

  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=3000",
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: "pipe" },
  );
  console.log(`docs/pdf/${name}.pdf`);
}

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error("Uso: npm run docs:pdf -- <nombre-del-documento> [otro]");
  process.exit(1);
}
for (const name of names) render(name);
