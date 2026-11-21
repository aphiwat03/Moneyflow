import { describe, expect, it } from "vitest";
import {
  buildRecipientLeaderboard,
  maskAccountNumber,
} from "@/lib/recipient-summary";
import type { TransactionDTO } from "@/lib/types";

function makeTx(overrides: Partial<TransactionDTO>): TransactionDTO {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? "expense",
    walletId: overrides.walletId ?? "w-1",
    walletName: overrides.walletName ?? "SCB",
    walletType: overrides.walletType ?? "bank",
    toWalletId: overrides.toWalletId ?? null,
    toWalletName: overrides.toWalletName ?? null,
    categoryId: overrides.categoryId ?? "c-1",
    categoryName: overrides.categoryName ?? "อาหาร",
    categoryColor: overrides.categoryColor ?? "#ef4444",
    amount: overrides.amount ?? "100.00",
    transactionDate: overrides.transactionDate ?? "2026-11-20",
    note: overrides.note ?? null,
    recipientName: overrides.recipientName ?? null,
    recipientBank: overrides.recipientBank ?? null,
    recipientAccount: overrides.recipientAccount ?? null,
  };
}

describe("maskAccountNumber", () => {
  it("normalizes already masked account strings", () => {
    expect(maskAccountNumber("XXX-X-X1234-X")).toBe("xxx-x-x1234-x");
    expect(maskAccountNumber("  ***-***-7890  ")).toBe("xxx-xxx-7890");
  });

  it("auto-masks full bank account or phone digits keeping only last 4 digits", () => {
    expect(maskAccountNumber("081-234-5678")).toBe("xxx-xxx-5678");
    expect(maskAccountNumber("0142567890")).toBe("xxxxxx7890");
  });

  it("handles empty or short values cleanly", () => {
    expect(maskAccountNumber(null)).toBeNull();
    expect(maskAccountNumber("   ")).toBeNull();
    expect(maskAccountNumber("1234")).toBe("1234");
  });
});

describe("buildRecipientLeaderboard", () => {
  const sampleTxs: TransactionDTO[] = [
    makeTx({
      id: "1",
      amount: "150.00",
      transactionDate: "2026-11-18",
      recipientName: "ร้านกาแฟอเมซอน",
      recipientBank: "K PLUS",
      recipientAccount: "xxx-x-x1111-x",
    }),
    makeTx({
      id: "2",
      amount: "120.00",
      transactionDate: "2026-11-20",
      recipientName: "ร้านกาแฟอเมซอน",
    }),
    makeTx({
      id: "3",
      amount: "1200.00",
      transactionDate: "2026-11-19",
      recipientName: "นาย สมชาย ใจดี",
      recipientBank: "SCB",
      recipientAccount: "xxx-x-x9999-x",
    }),
    makeTx({
      id: "4",
      amount: "50.00",
      transactionDate: "2026-11-21",
      recipientName: "ร้านกาแฟอเมซอน",
    }),
    makeTx({
      id: "5",
      amount: "5000.00",
      transactionDate: "2026-11-21",
      note: "รายการจดมือไม่มีผู้รับโอน",
    }),
  ];

  it("groups by recipient name, ignores entries without recipients, and sorts by total amount", () => {
    const groups = buildRecipientLeaderboard(sampleTxs, "amount");
    expect(groups).toHaveLength(2);

    expect(groups[0].recipientName).toBe("นาย สมชาย ใจดี");
    expect(groups[0].recipientBank).toBe("SCB");
    expect(groups[0].recipientAccount).toBe("xxx-x-x9999-x");
    expect(groups[0].totalAmount).toBe("1200.00");
    expect(groups[0].transferCount).toBe(1);
    expect(groups[0].shareOfMaxPct).toBe(100);

    expect(groups[1].recipientName).toBe("ร้านกาแฟอเมซอน");
    expect(groups[1].recipientBank).toBe("K PLUS");
    expect(groups[1].recipientAccount).toBe("xxx-x-x1111-x");
    expect(groups[1].totalAmount).toBe("320.00");
    expect(groups[1].transferCount).toBe(3);
    expect(groups[1].lastDate).toBe("2026-11-21");
    expect(groups[1].transactions[0].id).toBe("4");
  });

  it("sorts by transfer count when sortBy is 'count'", () => {
    const groups = buildRecipientLeaderboard(sampleTxs, "count");
    expect(groups[0].recipientName).toBe("ร้านกาแฟอเมซอน");
    expect(groups[0].transferCount).toBe(3);
    expect(groups[1].recipientName).toBe("นาย สมชาย ใจดี");
    expect(groups[1].transferCount).toBe(1);
  });
});
