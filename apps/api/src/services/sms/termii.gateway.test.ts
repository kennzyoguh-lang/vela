import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= "placeholder-32-bytes-min-for-test";
});

describe("termii.gateway#sendSms", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TERMII_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TERMII_API_KEY;
  });

  it("resolves without calling fetch when TERMII_API_KEY is unset — the app never crashes on a missing key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { sendSms } = await import("./termii.gateway");

    await expect(sendSms("+2348012345678", "Pay ₦150 now")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls Termii's send API with the configured key and sender ID once TERMII_API_KEY is set", async () => {
    process.env.TERMII_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: "ok", message_id: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { sendSms } = await import("./termii.gateway");

    await sendSms("+2348012345678", "Pay ₦150 now");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.ng.termii.com/api/sms/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          api_key: "test-key",
          to: "+2348012345678",
          from: "Vela",
          sms: "Pay ₦150 now",
          type: "plain",
          channel: "generic",
        }),
      }),
    );
  });

  it("throws a clear error when Termii's API reports failure", async () => {
    process.env.TERMII_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: "error", message: "Invalid phone number" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { sendSms } = await import("./termii.gateway");

    await expect(sendSms("bad-number", "Pay ₦150 now")).rejects.toThrow(/Invalid phone number/);
  });
});
