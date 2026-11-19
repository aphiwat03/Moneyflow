import { describe, expect, it } from "vitest";
import {
  normalizeThaiDigits,
  parseThaiBankSlip,
  pickSlipWalletId,
} from "@/lib/slip-parser";

describe("slip-parser", () => {
  it("normalizes Thai numerals cleanly", () => {
    expect(normalizeThaiDigits("๑๒๓.๔๕ บาท")).toBe("123.45 บาท");
  });

  it("extracts amount, BE date, recipient, and bank hint from K PLUS layout", () => {
    const rawText = [
      "โอนเงินสำเร็จ",
      "K PLUS",
      "19 พ.ย. 69 14.35 น.",
      "จาก นาย สมชาย ใจดี",
      "ไปยัง ร้านกาแฟอเมซอน สาขาสยาม",
      "จำนวนเงิน 1,250.50 บาท",
      "ค่าธรรมเนียม 0.00 บาท",
      "รหัสอ้างอิง 014321100456789",
    ].join("\n");

    const parsed = parseThaiBankSlip(rawText, [
      { text: "โอนเงินสำเร็จ", confidence: 0.98 },
      { text: "K PLUS", confidence: 0.99 },
      { text: "19 พ.ย. 69 14.35 น.", confidence: 0.95 },
      { text: "ไปยัง ร้านกาแฟอเมซอน สาขาสยาม", confidence: 0.94 },
      { text: "จำนวนเงิน 1,250.50 บาท", confidence: 0.97 },
      { text: "ค่าธรรมเนียม 0.00 บาท", confidence: 0.98 },
    ]);

    expect(parsed.amount).toBe("1250.50");
    expect(parsed.transactionDate).toBe("2026-11-19");
    expect(parsed.bankHint).toBe("K PLUS");
    expect(parsed.suggestedNote).toContain("ร้านกาแฟอเมซอน สาขาสยาม");
    expect(parsed.suggestedNote).toContain("K PLUS");
    expect(parsed.warnings).toEqual([]);
  });

  it("joins column cells sharing the same row index for SCB slips", () => {
    const parsed = parseThaiBankSlip("", [
      { text: "SCB EASY", row: 0, confidence: 0.97 },
      { text: "โอนเงินสำเร็จ", row: 1, confidence: 0.96 },
      { text: "วันที่ทำรายการ", row: 2, confidence: 0.95 },
      { text: "05 ธ.ค. 2569 - 09.18", row: 2, confidence: 0.94 },
      { text: "ไปยัง", row: 3, confidence: 0.96 },
      { text: "บจก. มินิบิ๊กซี", row: 3, confidence: 0.93 },
      { text: "จำนวนเงิน", row: 4, confidence: 0.98 },
      { text: "450.00", row: 4, confidence: 0.99 },
      { text: "ค่าธรรมเนียม", row: 5, confidence: 0.97 },
      { text: "0.00", row: 5, confidence: 0.98 },
    ]);

    expect(parsed.amount).toBe("450.00");
    expect(parsed.transactionDate).toBe("2026-12-05");
    expect(parsed.bankHint).toBe("SCB");
    expect(parsed.suggestedNote).toBe("บจก. มินิบิ๊กซี (SCB)");
  });

  it("ignores dotted clock times like 14.35 when amount is missing or present", () => {
    const withRealAmount = parseThaiBankSlip(
      "Krungthai NEXT\nวันที่ 02 ก.พ. 2569 เวลา 14.35 น.\nจำนวนเงิน 88.25 บาท"
    );
    expect(withRealAmount.amount).toBe("88.25");
    expect(withRealAmount.transactionDate).toBe("2026-02-02");
    expect(withRealAmount.bankHint).toBe("Krungthai");

    const onlyTime = parseThaiBankSlip("โอนเงินสำเร็จ\n14.35 น.\n02 ก.พ. 2569");
    expect(onlyTime.amount).toBeNull();
    expect(onlyTime.transactionDate).toBe("2026-02-02");
    expect(onlyTime.warnings.length).toBeGreaterThan(0);
  });

  it("handles English date slips cleanly", () => {
    const parsed = parseThaiBankSlip(
      "Bangkok Bank\nTransfer Successful\n19 Nov 2026, 18:45\nTo: Tops Market\nAmount 3,420.00 THB\nFee 0.00 THB"
    );

    expect(parsed.amount).toBe("3420.00");
    expect(parsed.transactionDate).toBe("2026-11-19");
    expect(parsed.bankHint).toBe("BBL");
    expect(parsed.suggestedNote).toBe("Tops Market (BBL)");
  });

  it("extracts amount, BE date, recipient, and memo from real SCB OCR lines", () => {
    const parsed = parseThaiBankSlip(
      "CD SCB\nโอนเงินสำเร็จ\n02 พ.ย. 2565 -11:34\nรหัสอ้างอิง: 202211022XMj8rGld6H8WNs\nไปยัง นาย ธนากร ขวัญพูล\nจำนวนเงิน 1,000.00\nบันทึกช่วยจำ\nชาญ"
    );

    expect(parsed.amount).toBe("1000.00");
    expect(parsed.transactionDate).toBe("2022-11-02");
    expect(parsed.bankHint).toBe("SCB");
    expect(parsed.suggestedNote).toBe("ชาญ · นาย ธนากร ขวัญพูล (SCB)");
  });

  it("picks a matching bank or non-cash wallet when currently on cash", () => {
    const wallets = [
      { id: "w-cash", name: "เงินสด", type: "cash" as const },
      { id: "w-kbank", name: "กสิกรไทย", type: "bank" as const },
      { id: "w-scb", name: "SCB ออมทรัพย์", type: "bank" as const },
    ];

    expect(pickSlipWalletId(wallets, "w-cash", "SCB")).toBe("w-scb");
    expect(pickSlipWalletId(wallets, "w-cash", "K PLUS")).toBe("w-kbank");
    expect(pickSlipWalletId(wallets, "w-cash", null)).toBe("w-kbank");
    expect(pickSlipWalletId(wallets, "w-scb", null)).toBeNull();
    expect(
      pickSlipWalletId([{ id: "w-cash", name: "เงินสด", type: "cash" }], "w-cash", "SCB")
    ).toBeNull();
  });

  it("returns null fields and helpful warnings when OCR text is unreadable", () => {
    const parsed = parseThaiBankSlip("ภาพเบลอ อ่านไม่ออก ###");

    expect(parsed.amount).toBeNull();
    expect(parsed.transactionDate).toBeNull();
    expect(parsed.warnings).toHaveLength(2);
    expect(parsed.confidence).toBeLessThan(0.5);
  });
});
