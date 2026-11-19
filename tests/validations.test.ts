import { describe, expect, it } from "vitest";
import {
  categorySchema,
  positiveMoneyStringSchema,
  salaryAllocationSchema,
  salarySettingsSchema,
  transactionSchema,
  walletSchema,
} from "@/lib/validations";

const WALLET_A = "11111111-1111-4111-8111-111111111111";
const WALLET_B = "22222222-2222-4222-8222-222222222222";
const CAT_EXPENSE = "33333333-3333-4333-8333-333333333333";

describe("Zod validation schemas", () => {
  it("normalizes positive money strings to 2 decimal places and rejects invalid values", () => {
    expect(positiveMoneyStringSchema.parse("150")).toBe("150.00");
    expect(positiveMoneyStringSchema.parse("99.5")).toBe("99.50");
    expect(() => positiveMoneyStringSchema.parse("0")).toThrow();
    expect(() => positiveMoneyStringSchema.parse("-10")).toThrow();
    expect(() => positiveMoneyStringSchema.parse("10.123")).toThrow();
    expect(() => positiveMoneyStringSchema.parse("abc")).toThrow();
  });

  it("enforces wallet initialBalance rules per wallet type", () => {
    expect(
      walletSchema.parse({
        name: "KBank Credit",
        type: "credit_card",
        initialBalance: "-2500.5",
      }).initialBalance
    ).toBe("-2500.50");

    expect(() =>
      walletSchema.parse({
        name: "เงินสด",
        type: "cash",
        initialBalance: "-100",
      })
    ).toThrow();
  });

  it("enforces integrity rules on income/expense vs transfer transactions", () => {
    const validExpense = transactionSchema.parse({
      type: "expense",
      walletId: WALLET_A,
      categoryId: CAT_EXPENSE,
      amount: "125.5",
      transactionDate: "2026-11-16",
      note: "Lunch",
    });
    expect(validExpense.amount).toBe("125.50");
    expect(validExpense.toWalletId).toBeNull();

    const validTransfer = transactionSchema.parse({
      type: "transfer",
      walletId: WALLET_A,
      toWalletId: WALLET_B,
      amount: "5000",
      transactionDate: "2026-11-16",
    });
    expect(validTransfer.categoryId).toBeNull();
    expect(validTransfer.toWalletId).toBe(WALLET_B);

    // Reject transfer to same wallet
    expect(() =>
      transactionSchema.parse({
        type: "transfer",
        walletId: WALLET_A,
        toWalletId: WALLET_A,
        amount: "100",
        transactionDate: "2026-11-16",
      })
    ).toThrow();

    // Reject transfer with categoryId
    expect(() =>
      transactionSchema.parse({
        type: "transfer",
        walletId: WALLET_A,
        toWalletId: WALLET_B,
        categoryId: CAT_EXPENSE,
        amount: "100",
        transactionDate: "2026-11-16",
      })
    ).toThrow();

    // Reject expense without categoryId
    expect(() =>
      transactionSchema.parse({
        type: "expense",
        walletId: WALLET_A,
        amount: "100",
        transactionDate: "2026-11-16",
      })
    ).toThrow();

    // Reject expense with toWalletId
    expect(() =>
      transactionSchema.parse({
        type: "expense",
        walletId: WALLET_A,
        toWalletId: WALLET_B,
        categoryId: CAT_EXPENSE,
        amount: "100",
        transactionDate: "2026-11-16",
      })
    ).toThrow();
  });

  it("validates category monthlyBudget only on expense categories", () => {
    const expCat = categorySchema.parse({
      name: "ค่าอาหาร",
      type: "expense",
      monthlyBudget: "5500.5",
    });
    expect(expCat.monthlyBudget).toBe("5500.50");

    expect(() =>
      categorySchema.parse({
        name: "เงินเดือน",
        type: "income",
        monthlyBudget: "5000",
      })
    ).toThrow();
  });

  it("validates salary settings and allocation buckets", () => {
    const settings = salarySettingsSchema.parse({
      monthlySalary: "35000",
      payday: "1",
      salaryWalletId: WALLET_A,
    });
    expect(settings.monthlySalary).toBe("35000.00");
    expect(settings.extraIncome).toBe("0.00");
    expect(settings.payday).toBe(1);

    const partTimeSettings = salarySettingsSchema.parse({
      monthlySalary: "0",
      extraIncome: "2500.5",
      payday: 1,
    });
    expect(partTimeSettings.monthlySalary).toBe("0.00");
    expect(partTimeSettings.extraIncome).toBe("2500.50");

    expect(() =>
      salarySettingsSchema.parse({
        monthlySalary: "35000",
        extraIncome: "-100",
        payday: 1,
      })
    ).toThrow();

    expect(() =>
      salarySettingsSchema.parse({
        monthlySalary: "35000",
        payday: 32,
      })
    ).toThrow();

    const pctAlloc = salaryAllocationSchema.parse({
      name: "DCA",
      bucketType: "dca",
      mode: "percent",
      value: "15",
    });
    expect(pctAlloc.value).toBe("15.00");

    expect(() =>
      salaryAllocationSchema.parse({
        name: "Invalid Percent",
        bucketType: "dca",
        mode: "percent",
        value: "120",
      })
    ).toThrow();
  });
});
