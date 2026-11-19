import { describe, expect, it } from "vitest";
import { parseCsvTransactions, SAMPLE_CSV_TEMPLATE } from "@/lib/csv-import";
import type { CategoryDTO, WalletDTO } from "@/lib/types";

const WALLETS: WalletDTO[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "เงินสด",
    type: "cash",
    initialBalance: "0.00",
    currentBalance: "1000.00",
    color: "#10b981",
    icon: "Banknote",
    isArchived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "บัญชีธนาคารหลัก",
    type: "bank",
    initialBalance: "0.00",
    currentBalance: "5000.00",
    color: "#3b82f6",
    icon: "Landmark",
    isArchived: false,
  },
];

const CATEGORIES: CategoryDTO[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "อาหารและเครื่องดื่ม",
    type: "expense",
    monthlyBudget: "5000.00",
    color: "#f97316",
    icon: "Utensils",
    isDefault: true,
    isArchived: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "เงินเดือน",
    type: "income",
    monthlyBudget: null,
    color: "#22c55e",
    icon: "Briefcase",
    isDefault: true,
    isArchived: false,
  },
];

describe("CSV transaction importer", () => {
  it("parses income, expense, and transfer rows from SAMPLE_CSV_TEMPLATE", () => {
    const parsed = parseCsvTransactions(SAMPLE_CSV_TEMPLATE, WALLETS, CATEGORIES);
    expect(parsed).toHaveLength(3);
    expect(parsed.every((r) => r.valid)).toBe(true);

    expect(parsed[0].payload).toMatchObject({
      type: "income",
      walletId: WALLETS[1].id,
      categoryId: CATEGORIES[1].id,
      amount: "35000.00",
      transactionDate: "2026-11-01",
    });

    expect(parsed[1].payload).toMatchObject({
      type: "expense",
      walletId: WALLETS[0].id,
      categoryId: CATEGORIES[0].id,
      amount: "120.00",
      transactionDate: "2026-11-02",
    });

    expect(parsed[2].payload).toMatchObject({
      type: "transfer",
      walletId: WALLETS[1].id,
      toWalletId: WALLETS[0].id,
      categoryId: null,
      amount: "2000.00",
      transactionDate: "2026-11-03",
    });
  });

  it("flags rows with invalid dates or amounts", () => {
    const badCsv = `วันที่,ประเภท,หมวดหมู่,จากกระเป๋า,ไปยังกระเป๋า,รายละเอียด/หมายเหตุ,จำนวนเงิน
2026-02-31,รายจ่าย,อาหารและเครื่องดื่ม,เงินสด,-,วันที่ผิด,100.00
2026-11-05,รายจ่าย,อาหารและเครื่องดื่ม,เงินสด,-,ยอดติดลบ,-50.00`;

    const parsed = parseCsvTransactions(badCsv, WALLETS, CATEGORIES);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].valid).toBe(false);
    expect(parsed[1].valid).toBe(false);
  });

  it("rejects empty, unknown, or ambiguous wallet/category names and parses quoted multiline notes", () => {
    const edgeCsv = `วันที่,ประเภท,หมวดหมู่,จากกระเป๋า,ไปยังกระเป๋า,รายละเอียด/หมายเหตุ,จำนวนเงิน
2026-11-06,รายจ่าย,อาหารและเครื่องดื่ม,,-,ไม่ระบุกระเป๋า,100.00
2026-11-07,รายจ่าย,อาหารและเครื่องดื่ม,กระเป๋าไม่มีจริง,-,กระเป๋าผิด,100.00
2026-11-08,รายจ่าย,อาหาร,เงินสด,-,"บรรทัด1
บรรทัด2",150.00`;

    const parsed = parseCsvTransactions(edgeCsv, WALLETS, CATEGORIES);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].valid).toBe(false);
    expect(parsed[1].valid).toBe(false);
    expect(parsed[2].valid).toBe(true);
    expect(parsed[2].payload?.note).toBe("บรรทัด1\nบรรทัด2");

    // Ambiguous wallet substring when two wallets share "กระเป๋า"
    const dupWallets: WalletDTO[] = [
      ...WALLETS,
      { ...WALLETS[0], id: "10000000-0000-4000-8000-000000000003", name: "เงินสดสำรอง" },
    ];
    const ambigCsv = `วันที่,ประเภท,หมวดหมู่,จากกระเป๋า,ไปยังกระเป๋า,รายละเอียด/หมายเหตุ,จำนวนเงิน
2026-11-09,รายจ่าย,อาหารและเครื่องดื่ม,เงิน,-,ชื่อกำกวม,50.00`;
    const ambigParsed = parseCsvTransactions(ambigCsv, dupWallets, CATEGORIES);
    expect(ambigParsed).toHaveLength(1);
    expect(ambigParsed[0].valid).toBe(false);
  });
});
