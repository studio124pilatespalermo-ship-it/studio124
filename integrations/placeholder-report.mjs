// @ts-check
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PATTERN = /\{\{[A-Z0-9_]+\}\}/g;

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

/**
 * Al terminar el build, lista los datos pendientes ({{...}}) que quedaron en el HTML.
 * Con STRICT_PLACEHOLDERS=true el build falla: útil para el deploy de producción final.
 * @returns {import("astro").AstroIntegration}
 */
export default function placeholderReport() {
  return {
    name: "studio124:placeholder-report",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const found = new Set();
        for (const file of htmlFiles(fileURLToPath(dir))) {
          for (const match of readFileSync(file, "utf8").matchAll(PATTERN)) found.add(match[0]);
        }
        if (found.size === 0) {
          logger.info("Sin datos pendientes.");
          return;
        }
        const list = [...found].sort().join(", ");
        const message = `${found.size} datos pendientes en la página: ${list}`;
        if (process.env.STRICT_PLACEHOLDERS === "true") throw new Error(message);
        logger.warn(message);
      },
    },
  };
}
