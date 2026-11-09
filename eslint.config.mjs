import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Lint de la casa — simple y manejable (antes heredaba de eslint-config-next).
 * Base JS + TypeScript estricto en lo que importa + reglas clásicas de hooks
 * de React (rules-of-hooks + exhaustive-deps; las reglas «compiler» de la
 * v7 del plugin son ruido para este código y no las pedía la casa).
 * El código de la casa es español por diseño; los archivos de server/ corren
 * en Node (globals de node vía bun-types en tsconfig).
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "out/**",
      "server-dist/**",
      "standalone/**",
      "release/**",
      "build/**",
      "android/**",
      "public/**",
      "db/**",
      "scripts/**",
      "examples/**",
      ".opencode/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // las dos reglas clásicas de hooks — el resto del plugin v7 es ruido
      "react-hooks/rules-of-hooks": "error",
      // deps de efectos gestionadas a mano por la casa (comentarios en cada caso)
      "react-hooks/exhaustive-deps": "off",
      // la casa usa `any` acotado en tests y adaptadores (noImplicitAny: false)
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // el HTML de la casa usa <img> a propósito (streaming propio, sin optimizer)
      "no-html-link-for-pages": "off",
      // patrones de acumulación legítimos del teleprompter/cámara
      "no-useless-assignment": "off",
    },
  }
);

