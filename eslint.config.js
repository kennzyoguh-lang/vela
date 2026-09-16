// Flat ESLint config (ESLint 9) — shared base lives in packages/config/eslint,
// per-app overrides layer on top of it (apps/web adds the no-arbitrary-Tailwind-
// value / no-raw-hex rules, Handbook 4.4).
const tseslint = require("typescript-eslint");
const baseConfig = require("./packages/config/eslint/base.js");

module.exports = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      // Next.js-managed generated file, regenerated on every dev/build run —
      // never hand-edited. Next.js 15 added a typed-routes triple-slash
      // reference here that this project's own lint rules correctly flag,
      // but a generated file isn't something to fix, it's something to
      // exclude (same reasoning as .next/** above).
      "**/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  baseConfig,
);
