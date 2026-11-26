import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildMoneyFlowWorkbook } from "@/lib/excel";
import type { TransactionDTO } from "@/lib/types";

describe("ExcelJS workbook builder", () => {
  it("generates Summary, Transactions, and Guide sheets, includes tags, sanitizes formulas, and preserves numeric amounts", async () => {
    const sample: TransactionDTO[] = [
      {
        id: "tx-1",
        type: "expense",
        walletId: "w-1",
        walletName: "เงินสด",
        walletType: "cash",
        toWalletId: null,
        toWalletName: null,
        categoryId: "c-1",
        categoryName: "อาหารและเครื่องดื่ม",
        categoryColor: "#f97316",
        amount: "1250.75",
        transactionDate: "2026-11-16",
        transactionTime: "12:30",
        tag: "ร้านกาแฟ",
        note: "=HYPERLINK(\"http://evil.example\")",
        recipientName: "Cafe Amazon",
        recipientBank: "กสิกรไทย (K PLUS)",
      },
      {
        id: "tx-2",
        type: "transfer",
        walletId: "w-2",
        walletName: "ธนาคาร",
        walletType: "bank",
        toWalletId: "w-1",
        toWalletName: "เงินสด",
        categoryId: null,
        categoryName: null,
        categoryColor: null,
        amount: "500.00",
        transactionDate: "2026-11-15",
        note: "ถอนเงินสด",
      },
    ];

    const bytes = await buildMoneyFlowWorkbook({
      transactions: sample,
      periodLabel: "2026-11-01 ถึง 2026-11-30",
      generatedAtBangkok: "2026-11-16",
    });

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);

    const summarySheet = loaded.getWorksheet("Summary");
    const txSheet = loaded.getWorksheet("Transactions");
    const guideSheet = loaded.getWorksheet("คำอธิบาย");

    expect(summarySheet).toBeDefined();
    expect(txSheet).toBeDefined();
    expect(guideSheet).toBeDefined();

    // Row 2 in Transactions should be 2026-11-16 (sorted descending)
    const row2 = txSheet!.getRow(2);
    expect(row2.getCell(2).value).toBe("12:30");
    expect(row2.getCell(5).value).toBe("ร้านกาแฟ");
    expect(row2.getCell(8).value).toBe("'=HYPERLINK(\"http://evil.example\")");
    expect(row2.getCell(9).value).toBe("Cafe Amazon (กสิกรไทย (K PLUS))");
    expect(row2.getCell(10).value).toBe(1250.75);
    expect(row2.getCell(10).numFmt).toBe("#,##0.00");
  });
});
