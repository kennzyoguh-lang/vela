import { randomBytes } from "node:crypto";
import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "./encryption";

// A real 32-byte key, same as twofa.service.test.ts's own fixture — these
// tests exercise the actual cipher, not a mock.
const KEY = randomBytes(32).toString("base64");

describe("lib/encryption", () => {
  it("round-trips a secret through encrypt then decrypt", () => {
    const ciphertext = encryptSecret("sk_live_super_secret", KEY, "org-1:paystack");
    expect(decryptSecret(ciphertext, KEY, "org-1:paystack")).toBe("sk_live_super_secret");
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encryptSecret("sk_live_super_secret", KEY, "org-1:paystack");
    const b = encryptSecret("sk_live_super_secret", KEY, "org-1:paystack");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong AAD (ciphertext bound to a different owner)", () => {
    const ciphertext = encryptSecret("sk_live_super_secret", KEY, "org-1:paystack");
    expect(() => decryptSecret(ciphertext, KEY, "org-2:paystack")).toThrow();
  });

  it("fails to decrypt with the wrong key", () => {
    const otherKey = randomBytes(32).toString("base64");
    const ciphertext = encryptSecret("sk_live_super_secret", KEY, "org-1:paystack");
    expect(() => decryptSecret(ciphertext, otherKey, "org-1:paystack")).toThrow();
  });

  it("fails to decrypt a tampered ciphertext", () => {
    const ciphertext = encryptSecret("sk_live_super_secret", KEY, "org-1:paystack");
    const raw = Buffer.from(ciphertext, "base64");
    const lastByte = raw[raw.length - 1]!;
    raw[raw.length - 1] = lastByte ^ 0xff; // flip the last byte
    const tampered = raw.toString("base64");
    expect(() => decryptSecret(tampered, KEY, "org-1:paystack")).toThrow();
  });
});
