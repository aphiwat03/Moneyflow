import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildMoneyFlowWorkbook } from "@/lib/excel";
import type { TransactionDTO } from "@/lib/types";

describe("ExcelJS workbook builder", () => {
  it("generates Summary and Transactions sheets, sanitizes formulas, and preserves numeric amounts", async () => {
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
        categoryName: "อาหาร",
        categoryColor: "#f97316",
        amount: "1250.75",
        transactionDate: "2026-11-16",
        note: "=HYPERLINK(\"http://evil.example\")",
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

    expect(summarySheet).toBeDefined();
    expect(txSheet).toBeDefined();

    // Row 2 in Transactions should be 2026-11-16 (sorted descending)
    const row2 = txSheet!.getRow(2);
    expect(row2.getCell(6).value).toBe("'=HYPERLINK(\"http://evil.example\")");
    expect(row2.getCell(7).value).toBe(1250.75);
    expect(row2.getCell(7).numFmt).toBe("#,##0.00");
  });
});
