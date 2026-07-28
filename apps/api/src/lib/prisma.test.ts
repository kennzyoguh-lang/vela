import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
});

describe("withOrgScope", () => {
  it("rejects a non-UUID orgId before ever touching the database", async () => {
    const { withOrgScope } = await import("./prisma");
    await expect(withOrgScope("not-a-uuid", async (tx) => tx)).rejects.toThrow(/non-UUID orgId/);
  });

  it("rejects an orgId with SQL-injection-shaped input", async () => {
    const { withOrgScope } = await import("./prisma");
    await expect(withOrgScope("'; DROP TABLE organisations; --", async (tx) => tx)).rejects.toThrow(
      /non-UUID orgId/,
    );
  });
});
