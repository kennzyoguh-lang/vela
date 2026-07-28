// Flat ESLint config (ESLint 9) — shared base lives in packages/config/eslint,
// per-app overrides layer on top of it (apps/web adds the no-arbitrary-Tailwind-
// value / no-raw-hex rules, Handbook 4.4).
const tseslint = require("typescript-eslint");
const baseConfig = require("./packages/config/eslint/base.js");

module.exports = tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/.turbo/**", "**/coverage/**"],
  },
  ...tseslint.configs.recommended,
  baseConfig,
);
