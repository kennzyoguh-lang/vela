import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/env", () => ({
  env: { MINDEE_API_KEY: undefined as string | undefined },
}));

import { env } from "../lib/env";
import * as receiptOcrService from "./receipt-ocr.service";

describe("receipt-ocr.service", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    env.MINDEE_API_KEY = undefined;
  });

  describe("isConfigured", () => {
    it("is false when MINDEE_API_KEY is unset", () => {
      expect(receiptOcrService.isConfigured()).toBe(false);
    });

    it("is true once MINDEE_API_KEY is set", () => {
      env.MINDEE_API_KEY = "test-key";
      expect(receiptOcrService.isConfigured()).toBe(true);
    });
  });

  describe("extractReceiptData", () => {
    it("returns null without calling out when OCR isn't configured", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const result = await receiptOcrService.extractReceiptData(
        Buffer.from("fake image bytes"),
        "receipt.jpg",
        "image/jpeg",
      );

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("extracts vendor/amount/currency/date from a successful Mindee response", async () => {
      env.MINDEE_API_KEY = "test-key";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            document: {
              inference: {
                prediction: {
                  supplier_name: { value: "Shoprite" },
                  total_amount: { value: 15750.5 },
                  date: { value: "2026-08-12" },
                  locale: { currency: "NGN" },
                },
              },
            },
          }),
        }),
      );

      const result = await receiptOcrService.extractReceiptData(
        Buffer.from("fake image bytes"),
        "receipt.jpg",
        "image/jpeg",
      );

      expect(result).toEqual({
        vendor: "Shoprite",
        amount: 15750.5,
        currency: "NGN",
        date: "2026-08-12",
      });
    });

    it("returns null (never throws) when Mindee responds with an error status", async () => {
      env.MINDEE_API_KEY = "test-key";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

      const result = await receiptOcrService.extractReceiptData(
        Buffer.from("fake image bytes"),
        "receipt.jpg",
        "image/jpeg",
      );

      expect(result).toBeNull();
    });

    it("returns null (never throws) when the request itself fails", async () => {
      env.MINDEE_API_KEY = "test-key";
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      const result = await receiptOcrService.extractReceiptData(
        Buffer.from("fake image bytes"),
        "receipt.jpg",
        "image/jpeg",
      );

      expect(result).toBeNull();
    });
  });
});
