import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias — without this, any unit
// test whose source file uses the (near-universal, in this app) "@/..."
// import convention fails to resolve under plain vitest, since Vite doesn't
// read tsconfig paths on its own without this or a plugin.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
