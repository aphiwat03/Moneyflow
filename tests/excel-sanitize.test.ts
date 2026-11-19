import { describe, expect, it } from "vitest";
import { sanitizeExcelCellText } from "@/lib/excel-sanitize";

describe("sanitizeExcelCellText", () => {
  it("prefixes formula injection trigger characters with a single quote", () => {
    expect(sanitizeExcelCellText("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeExcelCellText("+1+2")).toBe("'+1+2");
    expect(sanitizeExcelCellText("-cmd|' /C calc'!A0")).toBe(
      "'-cmd|' /C calc'!A0"
    );
    expect(sanitizeExcelCellText("@SUM(1+1)")).toBe("'@SUM(1+1)");
    expect(sanitizeExcelCellText("\t=1")).toBe("'\t=1");
    expect(sanitizeExcelCellText("\r=1")).toBe("'\r=1");
  });

  it("leaves safe strings untouched and returns empty string for nullish values", () => {
    expect(sanitizeExcelCellText("ค่าอาหารกลางวัน")).toBe("ค่าอาหารกลางวัน");
    expect(sanitizeExcelCellText(null)).toBe("");
    expect(sanitizeExcelCellText(undefined)).toBe("");
  });
});
