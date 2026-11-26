import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import { getBangkokToday, getTransactionDisplayTime } from "./date";
import { sanitizeExcelCellText } from "./excel-sanitize";
import {
  EXPENSE_CATEGORY_DESCRIPTIONS,
  INCOME_CATEGORY_DESCRIPTIONS,
  TRANSACTION_TAGS,
} from "./transaction-tags";
import type { TransactionDTO } from "./types";

const TYPE_LABEL: Record<TransactionDTO["type"], string> = {
  income: "รายรับ",
  expense: "รายจ่าย",
  transfer: "โอนย้าย",
};

const TYPE_FONT_COLOR: Record<TransactionDTO["type"], string> = {
  income: "FF059669",
  expense: "FFE11D48",
  transfer: "FF0284C7",
};

function parseIsoDateToUtcDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function styleTableHeader(row: ExcelJS.Row, bgArgb: string) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgArgb },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
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
    { name: string; type: "income" | "expense"; count: number; total: Decimal }
  >();

  const tagSummary = new Map<
    string,
    { name: string; type: "income" | "expense"; count: number; total: Decimal }
  >();

  const walletSummary = new Map<
    string,
    {
      name: string;
      income: Decimal;
      expense: Decimal;
      transferIn: Decimal;
      transferOut: Decimal;
    }
  >();

  const ensureWallet = (name: string) => {
    let bucket = walletSummary.get(name);
    if (!bucket) {
      bucket = {
        name,
        income: new Decimal(0),
        expense: new Decimal(0),
        transferIn: new Decimal(0),
        transferOut: new Decimal(0),
      };
      walletSummary.set(name, bucket);
    }
    return bucket;
  };

  for (const tx of transactions) {
    const amount = new Decimal(tx.amount);
    const sourceWallet = ensureWallet(tx.walletName);

    if (tx.type === "income") {
      totalIncome = totalIncome.plus(amount);
      sourceWallet.income = sourceWallet.income.plus(amount);
    } else if (tx.type === "expense") {
      totalExpense = totalExpense.plus(amount);
      sourceWallet.expense = sourceWallet.expense.plus(amount);
    } else {
      totalTransfer = totalTransfer.plus(amount);
      sourceWallet.transferOut = sourceWallet.transferOut.plus(amount);
      if (tx.toWalletName) {
        const destWallet = ensureWallet(tx.toWalletName);
        destWallet.transferIn = destWallet.transferIn.plus(amount);
      }
    }

    if (tx.type === "income" || tx.type === "expense") {
      const catName = tx.categoryName ?? "ไม่ระบุหมวดหมู่";
      const catKey = `${tx.type}:${catName}`;
      const existingCat = categorySummary.get(catKey);
      if (existingCat) {
        existingCat.count += 1;
        existingCat.total = existingCat.total.plus(amount);
      } else {
        categorySummary.set(catKey, {
          name: catName,
          type: tx.type,
          count: 1,
          total: amount,
        });
      }

      const tagName = tx.tag?.trim() || "ไม่ระบุแท็ก";
      const tagKey = `${tx.type}:${tagName}`;
      const existingTag = tagSummary.get(tagKey);
      if (existingTag) {
        existingTag.count += 1;
        existingTag.total = existingTag.total.plus(amount);
      } else {
        tagSummary.set(tagKey, {
          name: tagName,
          type: tx.type,
          count: 1,
          total: amount,
        });
      }
    }
  }

  const netCashflow = totalIncome.minus(totalExpense);
  const savingsRate = totalIncome.gt(0)
    ? netCashflow.div(totalIncome).toNumber()
    : 0;

  // =========================================================================
  // Sheet 1: Summary (Dashboard ภาพรวม + หมวดหมู่ + แท็ก + กระเป๋าเงิน)
  // =========================================================================
  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: true }],
  });

  summarySheet.columns = [
    { key: "col1", width: 32 },
    { key: "col2", width: 16 },
    { key: "col3", width: 16 },
    { key: "col4", width: 18 },
    { key: "col5", width: 16 },
    { key: "col6", width: 18 },
  ];

  const titleRow = summarySheet.addRow(["MoneyFlow — รายงานสรุปรายรับ-รายจ่าย"]);
  titleRow.font = { bold: true, size: 15, color: { argb: "FF0F766E" } };

  summarySheet.addRow(["ช่วงข้อมูล", sanitizeExcelCellText(periodLabel)]);
  summarySheet.addRow(["วันที่ออกรายงาน (Asia/Bangkok)", generatedAt]);
  summarySheet.addRow(["จำนวนรายการทั้งหมด", transactions.length]);
  summarySheet.addRow([]);

  // Overview KPI Table
  const overviewHeader = summarySheet.addRow(["สรุปภาพรวม", "จำนวนเงิน (บาท)"]);
  styleTableHeader(overviewHeader, "FF0F766E");
  overviewHeader.getCell(2).alignment = { vertical: "middle", horizontal: "right" };

  const summaryRows: Array<[string, number, string, string?]> = [
    ["รายรับรวม (ไม่รวมโอนย้าย)", totalIncome.toNumber(), "#,##0.00", "FF059669"],
    ["รายจ่ายรวม (ไม่รวมโอนย้าย)", totalExpense.toNumber(), "#,##0.00", "FFE11D48"],
    [
      "คงเหลือสุทธิ (รายรับ - รายจ่าย)",
      netCashflow.toNumber(),
      "#,##0.00",
      netCashflow.gte(0) ? "FF0F766E" : "FFE11D48",
    ],
    ["ยอดโอนย้ายระหว่างบัญชีรวม", totalTransfer.toNumber(), "#,##0.00", "FF0284C7"],
    ["อัตราคงเหลือ / การออม (%)", savingsRate, "0.0%"],
  ];

  for (const [label, value, numFmt, color] of summaryRows) {
    const row = summarySheet.addRow([label, value]);
    row.getCell(2).numFmt = numFmt;
    row.getCell(2).alignment = { horizontal: "right" };
    if (color) {
      row.getCell(2).font = {
        bold: label.startsWith("คงเหลือสุทธิ"),
        color: { argb: color },
      };
    }
    if (label.startsWith("คงเหลือสุทธิ")) {
      row.getCell(1).font = { bold: true };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0FDFA" },
      };
    }
  }

  summarySheet.addRow([]);

  // Category Summary Table
  const catHeader = summarySheet.addRow([
    "สรุปตามหมวดหมู่",
    "ประเภท",
    "จำนวนรายการ",
    "ยอดรวม (บาท)",
    "สัดส่วน (%)",
  ]);
  styleTableHeader(catHeader, "FF1E293B");
  catHeader.getCell(3).alignment = { vertical: "middle", horizontal: "right" };
  catHeader.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
  catHeader.getCell(5).alignment = { vertical: "middle", horizontal: "right" };

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
      item.count,
      item.total.toNumber(),
      share,
    ]);
    row.getCell(2).font = { color: { argb: TYPE_FONT_COLOR[item.type] } };
    row.getCell(3).numFmt = "#,##0";
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(5).numFmt = "0.0%";
    row.getCell(5).alignment = { horizontal: "right" };
  }

  summarySheet.addRow([]);

  // Tag Summary Table
  const tagHeader = summarySheet.addRow([
    "สรุปตามแท็ก (Tags)",
    "ประเภท",
    "จำนวนรายการ",
    "ยอดรวม (บาท)",
    "สัดส่วน (%)",
  ]);
  styleTableHeader(tagHeader, "FF0F766E");
  tagHeader.getCell(3).alignment = { vertical: "middle", horizontal: "right" };
  tagHeader.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
  tagHeader.getCell(5).alignment = { vertical: "middle", horizontal: "right" };

  const sortedTags = Array.from(tagSummary.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type === "expense" ? -1 : 1;
    return b.total.comparedTo(a.total);
  });

  for (const item of sortedTags) {
    const base = item.type === "expense" ? totalExpense : totalIncome;
    const share = base.gt(0) ? item.total.div(base).toNumber() : 0;
    const row = summarySheet.addRow([
      sanitizeExcelCellText(item.name),
      TYPE_LABEL[item.type],
      item.count,
      item.total.toNumber(),
      share,
    ]);
    row.getCell(2).font = { color: { argb: TYPE_FONT_COLOR[item.type] } };
    row.getCell(3).numFmt = "#,##0";
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(5).numFmt = "0.0%";
    row.getCell(5).alignment = { horizontal: "right" };
  }

  summarySheet.addRow([]);

  // Wallet Cashflow Summary Table
  const walletHeader = summarySheet.addRow([
    "สรุปกระแสเงินตามกระเป๋า",
    "รายรับ",
    "รายจ่าย",
    "โอนเข้า",
    "โอนออก",
    "สุทธิในช่วงนี้",
  ]);
  styleTableHeader(walletHeader, "FF334155");
  for (let col = 2; col <= 6; col += 1) {
    walletHeader.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
  }

  for (const w of walletSummary.values()) {
    const net = w.income.minus(w.expense).plus(w.transferIn).minus(w.transferOut);
    const row = summarySheet.addRow([
      sanitizeExcelCellText(w.name),
      w.income.toNumber(),
      w.expense.toNumber(),
      w.transferIn.toNumber(),
      w.transferOut.toNumber(),
      net.toNumber(),
    ]);
    for (let col = 2; col <= 6; col += 1) {
      row.getCell(col).numFmt = "#,##0.00";
      row.getCell(col).alignment = { horizontal: "right" };
    }
    row.getCell(6).font = {
      bold: true,
      color: { argb: net.gte(0) ? "FF059669" : "FFE11D48" },
    };
  }

  // =========================================================================
  // Sheet 2: Transactions (ตารางบันทึกรายรับ-รายจ่าย ครบคอลัมน์ + AutoFilter + SUM)
  // =========================================================================
  const txSheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  txSheet.columns = [
    { header: "วันที่", key: "date", width: 13 },
    { header: "เวลา", key: "time", width: 9 },
    { header: "ประเภท", key: "type", width: 11 },
    { header: "หมวดหมู่", key: "category", width: 22 },
    { header: "แท็ก", key: "tag", width: 22 },
    { header: "จากกระเป๋า", key: "wallet", width: 20 },
    { header: "ไปยังกระเป๋า", key: "toWallet", width: 20 },
    { header: "รายละเอียด", key: "note", width: 32 },
    { header: "ผู้รับ / ร้านค้า", key: "recipient", width: 24 },
    { header: "จำนวนเงิน (บาท)", key: "amount", width: 18 },
  ];

  const txHeaderRow = txSheet.getRow(1);
  styleTableHeader(txHeaderRow, "FF0F766E");
  txHeaderRow.getCell(10).alignment = { vertical: "middle", horizontal: "right" };

  const orderedTx = [...transactions].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate)
  );

  let grandTotalAmount = new Decimal(0);

  orderedTx.forEach((tx, index) => {
    const amountDec = new Decimal(tx.amount);
    grandTotalAmount = grandTotalAmount.plus(amountDec);
    const displayTime = getTransactionDisplayTime(tx);
    const recipientDisplay = tx.recipientName
      ? `${tx.recipientName}${tx.recipientBank ? ` (${tx.recipientBank})` : ""}`
      : tx.recipientBank ?? "-";

    const row = txSheet.addRow({
      date: parseIsoDateToUtcDate(tx.transactionDate),
      time: displayTime ?? "-",
      type: TYPE_LABEL[tx.type],
      category:
        tx.type === "transfer"
          ? "โอนย้ายระหว่างบัญชี"
          : sanitizeExcelCellText(tx.categoryName ?? "-"),
      tag: tx.tag ? sanitizeExcelCellText(tx.tag) : "-",
      wallet: sanitizeExcelCellText(tx.walletName),
      toWallet: tx.toWalletName ? sanitizeExcelCellText(tx.toWalletName) : "-",
      note: sanitizeExcelCellText(tx.note),
      recipient: sanitizeExcelCellText(recipientDisplay),
      amount: amountDec.toNumber(),
    });

    row.getCell(1).numFmt = "yyyy-mm-dd";
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(3).font = { bold: true, color: { argb: TYPE_FONT_COLOR[tx.type] } };
    row.getCell(10).numFmt = "#,##0.00";
    row.getCell(10).alignment = { horizontal: "right" };
    row.getCell(10).font = { color: { argb: TYPE_FONT_COLOR[tx.type] } };

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }
  });

  if (orderedTx.length > 0) {
    txSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: orderedTx.length + 1, column: 10 },
    };

    const lastDataRow = orderedTx.length + 1;
    const totalRow = txSheet.addRow({
      date: "รวมทั้งหมด",
      time: `${orderedTx.length} รายการ`,
      amount: {
        formula: `SUM(J2:J${lastDataRow})`,
        result: grandTotalAmount.toNumber(),
      },
    });
    totalRow.font = { bold: true };
    totalRow.getCell(10).numFmt = "#,##0.00";
    totalRow.getCell(10).alignment = { horizontal: "right" };
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0FDFA" },
      };
    });
  }

  // =========================================================================
  // Sheet 3: คำอธิบาย (ตารางอ้างอิงหมวดหมู่และแท็กมาตรฐาน)
  // =========================================================================
  const guideSheet = workbook.addWorksheet("คำอธิบาย", {
    views: [{ showGridLines: true }],
  });

  guideSheet.columns = [
    { key: "g1", width: 24 },
    { key: "g2", width: 42 },
    { key: "g3", width: 4 },
    { key: "g4", width: 24 },
    { key: "g5", width: 22 },
    { key: "g6", width: 42 },
  ];

  const guideTitle = guideSheet.addRow([
    "คำอธิบายหมวดหมู่และแท็ก (MoneyFlow)",
  ]);
  guideTitle.font = { bold: true, size: 14, color: { argb: "FF0F766E" } };
  guideSheet.addRow([
    "ใช้อ้างอิงความหมายของหมวดรายจ่าย หมวดรายรับ และแท็กย่อยที่รองรับในระบบ",
  ]);
  guideSheet.addRow([]);

  const guideHeader = guideSheet.addRow([
    "หมวดหมู่ (รายจ่าย / รายรับ)",
    "คำอธิบายหมวดหมู่",
    "",
    "แท็ก (Tags)",
    "กลุ่มหมวดหมู่",
    "คำอธิบายแท็ก",
  ]);
  guideHeader.height = 24;
  for (const colIdx of [1, 2, 4, 5, 6]) {
    const cell = guideHeader.getCell(colIdx);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colIdx <= 2 ? "FF1E293B" : "FF0F766E" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }

  const leftRows: Array<[string, string, boolean?]> = [
    ["[หมวดรายจ่าย]", "หมวดหมู่สำหรับบันทึกรายจ่าย", true],
    ...EXPENSE_CATEGORY_DESCRIPTIONS.map(
      (c): [string, string] => [c.name, c.description]
    ),
    ["", ""],
    ["[หมวดรายรับ]", "หมวดหมู่สำหรับบันทึกรายรับ", true],
    ...INCOME_CATEGORY_DESCRIPTIONS.map(
      (c): [string, string] => [c.name, c.description]
    ),
  ];

  const maxGuideRows = Math.max(leftRows.length, TRANSACTION_TAGS.length);
  for (let i = 0; i < maxGuideRows; i += 1) {
    const left = leftRows[i];
    const right = TRANSACTION_TAGS[i];
    const row = guideSheet.addRow([
      left?.[0] ?? "",
      left?.[1] ?? "",
      "",
      right?.name ?? "",
      right?.categoryName ?? "",
      right?.description ?? "",
    ]);
    if (left?.[2]) {
      row.getCell(1).font = { bold: true, color: { argb: "FF0F766E" } };
      row.getCell(2).font = { bold: true, color: { argb: "FF475569" } };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
