import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
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
  { ignores: ["dist/", ".astro/", ".vercel/", "node_modules/"] },
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
);
