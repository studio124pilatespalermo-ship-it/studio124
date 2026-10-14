// @ts-check
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} dir @param {string} ext @returns {string[]} */
function files(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, ext);
    return entry.name.endsWith(ext) ? [path] : [];
  });
}

/** Rutas del sistema de reservas, que NO forman parte de la landing pública. */
const PRIVATE_ROUTES = ["/admin", "/cuenta"];

/**
 * Esta rama publica sólo la landing. El sistema de reservas (panel /admin, portal /cuenta y
 * API) vive en la rama `sistema-reservas` y no tiene que llegar al sitio público.
 * Al terminar el build verifica que no haya páginas, links ni entradas del sitemap que
 * apunten a esas rutas; si las hay, el build falla y no se publica nada.
 * @returns {import("astro").AstroIntegration}
 */
export default function landingGuard() {
  return {
    name: "studio124:landing-guard",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const problems = [];

        for (const route of PRIVATE_ROUTES) {
          if (existsSync(join(root, route))) problems.push(`existe la carpeta ${route}/ en el build`);
        }

        const linkPattern = new RegExp(`(?:href|src|action)=["'](?:https?://[^/"']+)?(${PRIVATE_ROUTES.join("|")})(?:[/?#"'])`, "g");
        for (const file of files(root, ".html")) {
          const html = readFileSync(file, "utf8");
          for (const match of html.matchAll(linkPattern)) problems.push(`${relative(root, file)} enlaza a ${match[1]}`);
        }

        for (const file of files(root, ".xml")) {
          const xml = readFileSync(file, "utf8");
          for (const route of PRIVATE_ROUTES) {
            if (xml.includes(`${route}/`)) problems.push(`${relative(root, file)} lista ${route}/`);
          }
        }

        if (problems.length > 0) throw new Error(`El sistema de reservas se coló en la landing pública:\n - ${problems.join("\n - ")}`);
        logger.info("Landing sola: sin /admin, /cuenta ni links hacia ellos.");
      },
    },
  };
}
