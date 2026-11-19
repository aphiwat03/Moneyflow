import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, DEFAULT_WALLETS } from "@/db/seed-data";

describe("seed defaults", () => {
  it("contains default cash/bank wallets and both income and expense categories", () => {
    expect(DEFAULT_WALLETS.length).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "income")).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "expense")).toBe(true);
  });
});
