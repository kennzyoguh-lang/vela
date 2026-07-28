// Shared ESLint flat-config rules — Engineering Handbook Part 13.1 / Part 4.4.
// `any` banned outside narrowly-scoped, commented exceptions; no raw hex/arbitrary
// Tailwind values outside packages/design-tokens (enforced in the web app's config).
// Plain rules object (no `extends`) — flat config's `extends` field only accepts
// other flat config objects, not legacy eslintrc strings like "eslint:recommended";
// typescript-eslint's own recommended config (applied in eslint.config.js) covers
// the equivalent ground for .ts/.tsx files.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/ban-ts-comment": [
      "error",
      { "ts-ignore": "allow-with-description", minimumDescriptionLength: 10 },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};
