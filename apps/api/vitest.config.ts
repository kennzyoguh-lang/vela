import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // bcrypt (password/backup-code hashing, cost factor 12) is deliberately
    // slow — several sequential hash/compare calls in one test can exceed
    // vitest's 5s default under load. Real, not arbitrary: this cost factor
    // is the actual production setting (password.service.ts), not a test-only
    // shortcut, so the test timeout accommodates it rather than the reverse.
    testTimeout: 15_000,
  },
});
