/** Conventional Commits, per Engineering Handbook Part 12.2 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "refactor", "test", "chore", "perf", "security"],
    ],
  },
};
