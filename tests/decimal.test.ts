import { describe, expect, it } from "vitest";
import {
  computeNetWorthSummary,
  computeWalletBalance,
  formatMoneyDisplay,
  sumMoney,
} from "@/lib/decimal";

describe("decimal money calculations", () => {
  it("avoids floating point errors when summing money strings", () => {
    const total = sumMoney(["0.10", "0.20", "1234.56"]);
    expect(total.toFixed(2)).toBe("1234.86");
    expect(formatMoneyDisplay(total)).toBe("1,234.86");
  });

  it("computes standard wallet and credit card balances accurately", () => {
    const bankBalance = computeWalletBalance({
      initialBalance: "10000.00",
      incomeTotal: "25000.00",
      expenseTotal: "4200.50",
      transferInTotal: "1000.00",
      transferOutTotal: "3500.00",
    });
    expect(bankBalance.toFixed(2)).toBe("28299.50");

    // Credit card starts at 0, spends 3500, repays 3500 via transfer -> back to 0.00
    const cardBeforePay = computeWalletBalance({
      initialBalance: "0.00",
      incomeTotal: "0.00",
      expenseTotal: "3500.00",
      transferInTotal: "0.00",
      transferOutTotal: "0.00",
    });
    expect(cardBeforePay.toFixed(2)).toBe("-3500.00");

    const cardAfterPay = computeWalletBalance({
      initialBalance: "0.00",
      incomeTotal: "0.00",
      expenseTotal: "3500.00",
      transferInTotal: "3500.00",
      transferOutTotal: "0.00",
    });
    expect(cardAfterPay.toFixed(2)).toBe("0.00");
  });

  it("computes net worth separating cash/bank from credit card debt", () => {
    const summary = computeNetWorthSummary([
      { type: "cash", balance: "1500.00" },
      { type: "bank", balance: "25000.00" },
      { type: "ewallet", balance: "500.25" },
      { type: "credit_card", balance: "-4200.25" },
    ]);

    expect(summary).toEqual({
      cashAndBankTotal: "27000.25",
      creditCardDebtTotal: "4200.25",
      creditCardNetBalance: "-4200.25",
      netWorth: "22800.00",
    });
  });
});
