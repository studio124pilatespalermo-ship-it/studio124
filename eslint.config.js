import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Límites acordados en el MASTER TEMPLATE: 80 líneas por función, 400 por archivo.
 * Las excepciones de abajo son acotadas y están justificadas una por una.
 */
const sizeLimits = {
  "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
  "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
  complexity: ["error", 10],
};

export default defineConfig(
  { ignores: ["dist/", ".astro/", ".vercel/", "node_modules/", "api/node_modules/", "api/.data/", "api/drizzle/"] },
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      ...sizeLimits,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Hooks de React: las reglas detectan errores reales (dependencias, estado en efectos).
    files: ["src/admin/**/*.{ts,tsx}", "src/client/**/*.{ts,tsx}", "src/portal/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Componentes React: el JSX es marcado, no lógica. Contar cada `&&` de una vista como
    // complejidad empuja a partir componentes por el límite y no por su responsabilidad.
    // La lógica vive en src/admin/lib y en api/, donde rigen los límites normales.
    files: ["**/*.tsx"],
    rules: {
      "max-lines-per-function": ["error", { max: 160, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 20],
    },
  },
  {
    // Registros de rutas: cada `app.get(...)` es un handler corto e independiente, no un
    // paso de una función larga. El límite por archivo (400) sigue vigente y es el que
    // obliga a dividir cuando un recurso crece de más.
    files: ["api/src/http/routes/*.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    // En la frontera con la base y con APIs externas abundan los `?? null` y los `?.`, que
    // ESLint cuenta como ramas. Son valores por defecto, no control de flujo: el umbral sube
    // a 15 para que la regla siga marcando funciones realmente enredadas.
    files: ["api/src/services/*.ts", "api/src/http/routes/*.ts", "src/client/lib/*.ts"],
    rules: { complexity: ["error", 15] },
  },
  {
    // En los tests, `const [row] = await db.insert(...).returning()` siempre devuelve la fila:
    // afirmarlo con `!` se lee mejor que un guard que nunca se cumple.
    files: ["api/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
);
