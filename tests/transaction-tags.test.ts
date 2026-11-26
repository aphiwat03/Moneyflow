import { describe, expect, it } from "vitest";
import {
  EXPENSE_CATEGORY_DESCRIPTIONS,
  getTagOptionsForCategory,
  INCOME_CATEGORY_DESCRIPTIONS,
  RECIPIENT_BANK_OPTIONS,
  TRANSACTION_TAGS,
} from "@/lib/transaction-tags";

describe("transaction tags catalog", () => {
  it("contains Thai expense/income categories, tags, and Thai bank dropdown options", () => {
    expect(EXPENSE_CATEGORY_DESCRIPTIONS.length).toBeGreaterThanOrEqual(16);
    expect(INCOME_CATEGORY_DESCRIPTIONS.length).toBeGreaterThanOrEqual(5);
    expect(TRANSACTION_TAGS.length).toBeGreaterThanOrEqual(48);
    expect(RECIPIENT_BANK_OPTIONS.length).toBeGreaterThanOrEqual(8);
  });

  it("prioritizes tags matching the selected category first and preserves custom tags", () => {
    const foodOptions = getTagOptionsForCategory({
      type: "expense",
      categoryName: "อาหารและเครื่องดื่ม",
      categoryColor: "#f97316",
    });

    expect(foodOptions[0]?.value).toBe("");
    expect(foodOptions[1]?.badge).toBe("แนะนำ");
    expect(foodOptions.some((o) => o.value === "ร้านกาแฟ" && o.badge === "แนะนำ")).toBe(
      true
    );

    const customOptions = getTagOptionsForCategory({
      type: "expense",
      categoryName: "อาหารและเครื่องดื่ม",
      currentTag: "แท็กพิเศษของฉัน",
    });
    expect(customOptions[1]).toMatchObject({
      value: "แท็กพิเศษของฉัน",
      badge: "กำหนดเอง",
    });
  });
});
