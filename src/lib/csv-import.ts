import type { TransactionFormInput } from "@/actions/transactions";
import { isValidIsoCalendarDate } from "./date";
import type { CategoryDTO, TransactionType, WalletDTO } from "./types";
import { positiveMoneyStringSchema } from "./validations";

export interface CsvImportCandidate {
  rowNumber: number;
  rawType: string;
  rawDate: string;
  rawAmount: string;
  rawWallet: string;
  rawToWallet: string;
  rawCategory: string;
  rawNote: string;
  valid: boolean;
  error?: string;
  payload?: TransactionFormInput;
}

/**
 * Parses CSV text into rows and trimmed cells while properly supporting
 * quoted newlines, escaped quotes (""), and BOM prefix.
 */
function parseCsvRecords(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];

    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && clean[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeType(raw: string): TransactionType | null {
  const v = raw.trim().toLowerCase();
  if (v === "income" || v === "รายรับ" || v === "รับ") return "income";
  if (v === "expense" || v === "รายจ่าย" || v === "จ่าย") return "expense";
  if (v === "transfer" || v === "โอนย้าย" || v === "โอน") return "transfer";
  return null;
}

function normalizeDate(raw: string): string | null {
  const cleaned = raw.trim().replace(/^'+/, "");
  if (isValidIsoCalendarDate(cleaned)) return cleaned;

  // Support DD/MM/YYYY (Common in Thai spreadsheets, including Buddhist Era years)
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    let yearNum = Number(slashMatch[3]);
    if (yearNum >= 2400) {
      yearNum -= 543;
    }
    const iso = `${yearNum}-${month}-${day}`;
    if (isValidIsoCalendarDate(iso)) return iso;
  }

  return null;
}

function resolveByName<T extends { name: string }>(
  items: T[],
  rawName: string
): { item?: T; error?: string } {
  const target = rawName.trim().replace(/^'+/, "").toLowerCase();
  if (!target) {
    return { error: "empty" };
  }

  const exact = items.find((item) => item.name.toLowerCase() === target);
  if (exact) {
    return { item: exact };
  }

  const partialMatches = items.filter((item) =>
    item.name.toLowerCase().includes(target)
  );
  if (partialMatches.length === 1) {
    return { item: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { error: "ambiguous" };
  }

  return { error: "not_found" };
}

export function parseCsvTransactions(
  csvText: string,
  wallets: WalletDTO[],
  categories: CategoryDTO[]
): CsvImportCandidate[] {
  const rows = parseCsvRecords(csvText);
  if (rows.length === 0) return [];

  // Detect header row
  const firstCols = rows[0].map((c) => c.toLowerCase());
  const hasHeader =
    firstCols.some(
      (c) =>
        c.includes("date") ||
        c.includes("วันที่") ||
        c.includes("amount") ||
        c.includes("จำนวนเงิน") ||
        c.includes("ประเภท")
    ) || !normalizeDate(firstCols[0] ?? "");

  const startIndex = hasHeader ? 1 : 0;
  const candidates: CsvImportCandidate[] = [];

  for (let i = startIndex; i < rows.length; i += 1) {
    const cols = rows[i];
    // Format A (7+ cols from MoneyFlow Export): วันที่, ประเภท, หมวดหมู่, จากกระเป๋า, ไปยังกระเป๋า, รายละเอียด/หมายเหตุ, จำนวนเงิน
    // Format B (5-6 cols simple): date, type, amount, wallet, category/toWallet, note
    let rawDate = "";
    let rawType = "";
    let rawCategory = "";
    let rawWallet = "";
    let rawToWallet = "";
    let rawNote = "";
    let rawAmount = "";

    if (cols.length >= 7) {
      [
        rawDate,
        rawType,
        rawCategory,
        rawWallet,
        rawToWallet,
        rawNote,
        rawAmount,
      ] = cols;
    } else {
      rawDate = cols[0] ?? "";
      rawType = cols[1] ?? "expense";
      rawAmount = cols[2] ?? "";
      rawWallet = cols[3] ?? "";
      rawCategory = cols[4] ?? "";
      rawNote = cols[5] ?? "";
    }

    const txDate = normalizeDate(rawDate);
    const txType = normalizeType(rawType);
    const cleanAmount = rawAmount.replace(/[,฿\s]/g, "");
    const parsedAmount = positiveMoneyStringSchema.safeParse(cleanAmount);

    if (!txDate) {
      candidates.push({
        rowNumber: i + 1,
        rawType,
        rawDate,
        rawAmount,
        rawWallet,
        rawToWallet,
        rawCategory,
        rawNote,
        valid: false,
        error: "รูปแบบวันที่ไม่ถูกต้อง (ใช้ YYYY-MM-DD หรือ DD/MM/YYYY)",
      });
      continue;
    }

    if (!txType) {
      candidates.push({
        rowNumber: i + 1,
        rawType,
        rawDate: txDate,
        rawAmount,
        rawWallet,
        rawToWallet,
        rawCategory,
        rawNote,
        valid: false,
        error: "ประเภทรายการไม่ถูกต้อง (ใช้ รายรับ / รายจ่าย / โอนย้าย)",
      });
      continue;
    }

    if (!parsedAmount.success) {
      candidates.push({
        rowNumber: i + 1,
        rawType: txType,
        rawDate: txDate,
        rawAmount,
        rawWallet,
        rawToWallet,
        rawCategory,
        rawNote,
        valid: false,
        error: "จำนวนเงินไม่ถูกต้อง",
      });
      continue;
    }

    const walletRes = resolveByName(wallets, rawWallet);
    if (!walletRes.item) {
      const msg =
        walletRes.error === "empty"
          ? "กรุณาระบุชื่อกระเป๋าเงินต้นทาง"
          : walletRes.error === "ambiguous"
            ? `ชื่อกระเป๋าเงิน "${rawWallet}" กำกวม กรุณาระบุให้ชัดเจน`
            : `ไม่พบกระเป๋าเงิน "${rawWallet}"`;
      candidates.push({
        rowNumber: i + 1,
        rawType: txType,
        rawDate: txDate,
        rawAmount: parsedAmount.data,
        rawWallet,
        rawToWallet,
        rawCategory,
        rawNote,
        valid: false,
        error: msg,
      });
      continue;
    }
    const sourceWallet = walletRes.item;

    if (txType === "transfer") {
      const destInput = rawToWallet || rawCategory;
      const destRes = resolveByName(wallets, destInput);
      const destWallet = destRes.item;
      if (!destWallet || destWallet.id === sourceWallet.id) {
        const msg =
          destRes.error === "ambiguous"
            ? `ชื่อกระเป๋าปลายทาง "${destInput}" กำกวม กรุณาระบุให้ชัดเจน`
            : destWallet?.id === sourceWallet.id
              ? "กระเป๋าปลายทางซ้ำกับกระเป๋าต้นทาง"
              : `ไม่พบกระเป๋าปลายทาง "${destInput}"`;
        candidates.push({
          rowNumber: i + 1,
          rawType: txType,
          rawDate: txDate,
          rawAmount: parsedAmount.data,
          rawWallet: sourceWallet.name,
          rawToWallet: destInput,
          rawCategory: "",
          rawNote,
          valid: false,
          error: msg,
        });
        continue;
      }

      candidates.push({
        rowNumber: i + 1,
        rawType: txType,
        rawDate: txDate,
        rawAmount: parsedAmount.data,
        rawWallet: sourceWallet.name,
        rawToWallet: destWallet.name,
        rawCategory: "-",
        rawNote,
        valid: true,
        payload: {
          type: "transfer",
          walletId: sourceWallet.id,
          toWalletId: destWallet.id,
          categoryId: null,
          amount: parsedAmount.data,
          transactionDate: txDate,
          note: rawNote.replace(/^'+/, "").trim() || null,
        },
      });
    } else {
      const matchingCats = categories.filter((c) => c.type === txType);
      const catRes = resolveByName(matchingCats, rawCategory);
      if (!catRes.item) {
        const msg =
          catRes.error === "empty"
            ? "กรุณาระบุชื่อหมวดหมู่"
            : catRes.error === "ambiguous"
              ? `ชื่อหมวดหมู่ "${rawCategory}" กำกวม กรุณาระบุให้ชัดเจน`
              : `ไม่พบหมวดหมู่ "${rawCategory}"`;
        candidates.push({
          rowNumber: i + 1,
          rawType: txType,
          rawDate: txDate,
          rawAmount: parsedAmount.data,
          rawWallet: sourceWallet.name,
          rawToWallet: "",
          rawCategory,
          rawNote,
          valid: false,
          error: msg,
        });
        continue;
      }
      const cat = catRes.item;

      candidates.push({
        rowNumber: i + 1,
        rawType: txType,
        rawDate: txDate,
        rawAmount: parsedAmount.data,
        rawWallet: sourceWallet.name,
        rawToWallet: "-",
        rawCategory: cat.name,
        rawNote,
        valid: true,
        payload: {
          type: txType,
          walletId: sourceWallet.id,
          toWalletId: null,
          categoryId: cat.id,
          amount: parsedAmount.data,
          transactionDate: txDate,
          note: rawNote.replace(/^'+/, "").trim() || null,
        },
      });
    }
  }

  return candidates;
}

export const SAMPLE_CSV_TEMPLATE = `วันที่,ประเภท,หมวดหมู่,จากกระเป๋า,ไปยังกระเป๋า,รายละเอียด/หมายเหตุ,จำนวนเงิน
2026-11-01,รายรับ,เงินเดือน,บัญชีธนาคารหลัก,-,เงินเดือนประจำเดือน,35000.00
2026-11-02,รายจ่าย,อาหารและเครื่องดื่ม,เงินสด,-,ค่าอาหารกลางวัน,120.00
2026-11-03,โอนย้าย,-,บัญชีธนาคารหลัก,เงินสด,กดเงินสดติดกระเป๋า,2000.00`;
