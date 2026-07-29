import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
  delete process.env.ANTHROPIC_API_KEY;
});

describe("anthropic-client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("importing the module never throws, even with ANTHROPIC_API_KEY unset — the app must still boot", async () => {
    await expect(import("./anthropic-client")).resolves.toBeDefined();
    await expect(import("../../lib/env")).resolves.toBeDefined();
  });

  it("getAnthropicClient() throws a clear error only when actually called, with the key unset", async () => {
    const { getAnthropicClient } = await import("./anthropic-client");
    expect(() => getAnthropicClient()).toThrow(/ANTHROPIC_API_KEY is not configured/);
  });

  it("getAnthropicClient() succeeds once the key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.resetModules();
    const { getAnthropicClient } = await import("./anthropic-client");
    expect(() => getAnthropicClient()).not.toThrow();
    delete process.env.ANTHROPIC_API_KEY;
  });
});
