import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= "placeholder-32-bytes-min-for-test";
});

describe("email.gateway#sendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });

  it("resolves without calling fetch when RESEND_API_KEY is unset — the app never crashes on a missing key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail } = await import("./email.gateway");

    await expect(
      sendEmail("owner@example.com", "Your VELA daily summary", "Today: 5 sales."),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls Resend's send API with the configured key once RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail } = await import("./email.gateway");

    await sendEmail("owner@example.com", "Your VELA daily summary", "Today: 5 sales.");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: JSON.stringify({
          from: "Vela <notifications@vela.app>",
          to: "owner@example.com",
          subject: "Your VELA daily summary",
          text: "Today: 5 sales.",
        }),
      }),
    );
  });

  it("includes an html field only when a caller passes one", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail } = await import("./email.gateway");

    await sendEmail(
      "owner@example.com",
      "Your VELA daily summary",
      "Today: 5 sales.",
      "<p>Today: 5 sales.</p>",
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: JSON.stringify({
          from: "Vela <notifications@vela.app>",
          to: "owner@example.com",
          subject: "Your VELA daily summary",
          text: "Today: 5 sales.",
          html: "<p>Today: 5 sales.</p>",
        }),
      }),
    );
  });

  it("throws a clear error when Resend's API reports failure", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ message: "Invalid recipient" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail } = await import("./email.gateway");

    await expect(
      sendEmail("bad-address", "Your VELA daily summary", "Today: 5 sales."),
    ).rejects.toThrow(/Invalid recipient/);
  });
});
