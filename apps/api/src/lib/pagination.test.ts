import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { parsePageParams, toPage } from "./pagination";

function stubRequest(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe("parsePageParams", () => {
  it("defaults to page 1, pageSize 50 when no query params are given", () => {
    expect(parsePageParams(stubRequest({}))).toEqual({ page: 1, pageSize: 50, skip: 0, take: 50 });
  });

  it("computes skip from page and pageSize", () => {
    expect(parsePageParams(stubRequest({ page: "3", pageSize: "20" }))).toEqual({
      page: 3,
      pageSize: 20,
      skip: 40,
      take: 20,
    });
  });

  it("caps pageSize at 100 even if the caller asks for more", () => {
    expect(parsePageParams(stubRequest({ pageSize: "500" })).pageSize).toBe(100);
  });

  it("falls back to defaults for non-numeric, zero, or negative input rather than trusting it", () => {
    expect(parsePageParams(stubRequest({ page: "abc", pageSize: "-5" }))).toEqual({
      page: 1,
      pageSize: 50,
      skip: 0,
      take: 50,
    });
    expect(parsePageParams(stubRequest({ page: "0" })).page).toBe(1);
  });
});

describe("toPage", () => {
  it("wraps items with the requesting page's own page/pageSize, not derived from the items array", () => {
    const params = { page: 2, pageSize: 10, skip: 10, take: 10 };
    const result = toPage(["a", "b"], 42, params);
    expect(result).toEqual({ items: ["a", "b"], total: 42, page: 2, pageSize: 10 });
  });
});
