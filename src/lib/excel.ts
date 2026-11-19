import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import { getBangkokToday } from "./date";
import { sanitizeExcelCellText } from "./excel-sanitize";
import type { TransactionDTO } from "./types";

const TYPE_LABEL: Record<TransactionDTO["type"], string> = {
  income: "รายรับ",
  expense: "รายจ่าย",
  transfer: "โอนย้าย",
};

function parseIsoDateToUtcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export interface BuildWorkbookOptions {
  transactions: TransactionDTO[];
  periodLabel: string;
  generatedAtBangkok?: string;
}

export async function buildMoneyFlowWorkbook(
  options: BuildWorkbookOptions
): Promise<Uint8Array> {
  const { transactions, periodLabel } = options;
  const generatedAt = options.generatedAtBangkok ?? getBangkokToday();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MoneyFlow";
  workbook.created = new Date();

  let totalIncome = new Decimal(0);
  let totalExpense = new Decimal(0);
  let totalTransfer = new Decimal(0);

  const categorySummary = new Map<
    string,
    { name: string; type: "income" | "expense"; total: Decimal }
  >();

  for (const tx of transactions) {
    const amount = new Decimal(tx.amount);
    if (tx.type === "income") {
      totalIncome = totalIncome.plus(amount);
    } else if (tx.type === "expense") {
      totalExpense = totalExpense.plus(amount);
    } else {
      totalTransfer = totalTransfer.plus(amount);
    }

    if (tx.type === "income" || tx.type === "expense") {
      const catName = tx.categoryName ?? "ไม่ระบุหมวดหมู่";
      const key = `${tx.type}:${catName}`;
      const existing = categorySummary.get(key);
      if (existing) {
        existing.total = existing.total.plus(amount);
      } else {
        categorySummary.set(key, {
          name: catName,
          type: tx.type,
          total: amount,
        });
      }
    }
  }

  const netCashflow = totalIncome.minus(totalExpense);

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: true }],
  });

  summarySheet.columns = [
    { key: "col1", width: 32 },
    { key: "col2", width: 18 },
    { key: "col3", width: 20 },
    { key: "col4", width: 16 },
  ];

  const titleRow = summarySheet.addRow(["MoneyFlow — รายงานสรุปรายรับ-รายจ่าย"]);
  titleRow.font = { bold: true, size: 15, color: { argb: "FF0F766E" } };

  summarySheet.addRow(["ช่วงข้อมูล", sanitizeExcelCellText(periodLabel)]);
  summarySheet.addRow(["วันที่ออกรายงาน (Asia/Bangkok)", generatedAt]);
  summarySheet.addRow([]);

  const overviewHeader = summarySheet.addRow(["สรุปภาพรวม", "จำนวนเงิน (บาท)"]);
  overviewHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
  });

  const summaryRows: Array<[string, Decimal]> = [
    ["รายรับรวม (ไม่รวมโอนย้าย)", totalIncome],
    ["รายจ่ายรวม (ไม่รวมโอนย้าย)", totalExpense],
    ["คงเหลือสุทธิ (รายรับ - รายจ่าย)", netCashflow],
    ["ยอดโอนย้ายระหว่างบัญชีรวม", totalTransfer],
  ];

  for (const [label, value] of summaryRows) {
    const row = summarySheet.addRow([label, value.toNumber()]);
    row.getCell(2).numFmt = "#,##0.00";
    if (label.startsWith("คงเหลือสุทธิ")) {
      row.font = { bold: true };
    }
  }

  summarySheet.addRow([]);

  const catHeader = summarySheet.addRow([
    "หมวดหมู่",
    "ประเภท",
    "ยอดรวม (บาท)",
    "สัดส่วน (%)",
  ]);
  catHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
  });

  const sortedCategories = Array.from(categorySummary.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type === "expense" ? -1 : 1;
    return b.total.comparedTo(a.total);
  });

  for (const item of sortedCategories) {
    const base = item.type === "expense" ? totalExpense : totalIncome;
    const share = base.gt(0) ? item.total.div(base).toNumber() : 0;
    const row = summarySheet.addRow([
      sanitizeExcelCellText(item.name),
      TYPE_LABEL[item.type],
      item.total.toNumber(),
      share,
    ]);
    row.getCell(3).numFmt = "#,##0.00";
    row.getCell(4).numFmt = "0.0%";
  }

  // Sheet 2: Transactions
  const txSheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  txSheet.columns = [
    { header: "วันที่", key: "date", width: 14 },
    { header: "ประเภท", key: "type", width: 12 },
    { header: "หมวดหมู่", key: "category", width: 22 },
    { header: "จากกระเป๋า", key: "wallet", width: 22 },
    { header: "ไปยังกระเป๋า", key: "toWallet", width: 22 },
    { header: "รายละเอียด", key: "note", width: 34 },
    { header: "จำนวนเงิน (บาท)", key: "amount", width: 18 },
  ];

  const txHeaderRow = txSheet.getRow(1);
  txHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  txHeaderRow.getCell(7).alignment = { vertical: "middle", horizontal: "right" };

  const orderedTx = [...transactions].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate)
  );

  for (const tx of orderedTx) {
    const row = txSheet.addRow({
      date: parseIsoDateToUtcDate(tx.transactionDate),
      type: TYPE_LABEL[tx.type],
      category:
        tx.type === "transfer"
          ? "โอนย้ายระหว่างบัญชี"
          : sanitizeExcelCellText(tx.categoryName ?? "-"),
      wallet: sanitizeExcelCellText(tx.walletName),
      toWallet: tx.toWalletName ? sanitizeExcelCellText(tx.toWalletName) : "-",
      note: sanitizeExcelCellText(tx.note),
      amount: new Decimal(tx.amount).toNumber(),
    });

    row.getCell(1).numFmt = "yyyy-mm-dd";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(7).alignment = { horizontal: "right" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
