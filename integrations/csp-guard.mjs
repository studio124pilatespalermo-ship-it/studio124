// @ts-check
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

/** Un <script> con código adentro (no JSON-LD ni con src) que la CSP bloquearía. */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>\s*\S/;

/**
 * La CSP de vercel.json es `script-src 'self'`: un script en línea no corre en producción,
 * aunque en local ande. Astro mete en línea los scripts chicos, así que este control hace
 * fallar el build si alguno quedó adentro del HTML.
 * @returns {import("astro").AstroIntegration}
 */
export default function cspGuard() {
  return {
    name: "studio124:csp-guard",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const offenders = htmlFiles(root).filter((file) => INLINE_SCRIPT.test(readFileSync(file, "utf8")));
        if (offenders.length > 0) {
          const list = offenders.map((file) => relative(root, file)).join(", ");
          throw new Error(`Scripts en línea que la CSP bloquearía en producción: ${list}`);
        }
        logger.info("Sin scripts en línea: la CSP no bloquea nada.");
      },
    },
  };
}
