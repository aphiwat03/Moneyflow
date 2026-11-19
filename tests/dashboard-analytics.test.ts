import { describe, expect, it } from "vitest";
import {
  buildDashboardAnalytics,
  computeWalletsWithBalances,
  filterTransactionsList,
} from "@/lib/dashboard-analytics";
import type { CategoryDTO, TransactionDTO, WalletDTO } from "@/lib/types";

const WALLETS_RAW: Array<Omit<WalletDTO, "currentBalance">> = [
  {
    id: "w-bank",
    name: "KBank",
    type: "bank",
    initialBalance: "10000.00",
    color: "#3b82f6",
    icon: "Landmark",
    isArchived: false,
  },
  {
    id: "w-card",
    name: "SCB Credit",
    type: "credit_card",
    initialBalance: "-1000.00",
    color: "#8b5cf6",
    icon: "CreditCard",
    isArchived: false,
  },
];

const CATEGORIES: CategoryDTO[] = [
  {
    id: "c-salary",
    name: "เงินเดือน",
    type: "income",
    monthlyBudget: null,
    color: "#22c55e",
    icon: "Briefcase",
    isDefault: true,
    isArchived: false,
  },
  {
    id: "c-food",
    name: "อาหาร",
    type: "expense",
    monthlyBudget: "1000.00",
    color: "#f97316",
    icon: "Utensils",
    isDefault: true,
    isArchived: false,
  },
];

const TRANSACTIONS: TransactionDTO[] = [
  {
    id: "t-1",
    type: "income",
    walletId: "w-bank",
    walletName: "KBank",
    walletType: "bank",
    toWalletId: null,
    toWalletName: null,
    categoryId: "c-salary",
    categoryName: "เงินเดือน",
    categoryColor: "#22c55e",
    amount: "20000.00",
    transactionDate: "2026-11-01",
    note: "เงินเดือน",
  },
  {
    id: "t-2",
    type: "expense",
    walletId: "w-card",
    walletName: "SCB Credit",
    walletType: "credit_card",
    toWalletId: null,
    toWalletName: null,
    categoryId: "c-food",
    categoryName: "อาหาร",
    categoryColor: "#f97316",
    amount: "500.00",
    transactionDate: "2026-11-05",
    note: "ดินเนอร์",
  },
  {
    id: "t-3",
    type: "transfer",
    walletId: "w-bank",
    walletName: "KBank",
    walletType: "bank",
    toWalletId: "w-card",
    toWalletName: "SCB Credit",
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    amount: "1000.00",
    transactionDate: "2026-11-08",
    note: "จ่ายบัตรเครดิต",
  },
];

describe("dashboard analytics & wallet balance engine", () => {
  it("computes balances across income, expense, and credit card transfer repayments", () => {
    const wallets = computeWalletsWithBalances(WALLETS_RAW, TRANSACTIONS);
    const bank = wallets.find((w) => w.id === "w-bank");
    const card = wallets.find((w) => w.id === "w-card");

    // Bank: 10000 + 20000 - 1000 = 29000.00
    expect(bank?.currentBalance).toBe("29000.00");
    // Credit card: -1000 - 500 + 1000 = -500.00
    expect(card?.currentBalance).toBe("-500.00");

    const analytics = buildDashboardAnalytics({
      wallets,
      categories: CATEGORIES,
      transactions: TRANSACTIONS,
      selectedYear: 2026,
      selectedMonth: 11,
    });

    // Transfers excluded from income & expense
    expect(analytics.periodIncome).toBe("20000.00");
    expect(analytics.periodExpense).toBe("500.00");
    expect(analytics.periodTransfer).toBe("1000.00");
    expect(analytics.cashAndBankTotal).toBe("29000.00");
    expect(analytics.creditCardDebtTotal).toBe("500.00");
    expect(analytics.netWorth).toBe("28500.00");
    expect(analytics.budgetStatuses).toEqual([
      {
        categoryId: "c-food",
        name: "อาหาร",
        color: "#f97316",
        budget: "1000.00",
        spent: "500.00",
        remaining: "500.00",
        percentage: 50,
        isOverBudget: false,
        isNearLimit: false,
      },
    ]);
  });

  it("filters transactions by search text, type, wallet, and date range", () => {
    expect(
      filterTransactionsList(TRANSACTIONS, { q: "บัตรเครดิต" }).map((t) => t.id)
    ).toEqual(["t-3"]);

    expect(
      filterTransactionsList(TRANSACTIONS, { walletId: "w-card" }).map(
        (t) => t.id
      )
    ).toEqual(["t-2", "t-3"]);

    expect(
      filterTransactionsList(TRANSACTIONS, {
        startDate: "2026-11-04",
        endDate: "2026-11-06",
      }).map((t) => t.id)
    ).toEqual(["t-2"]);
  });

  it("returns all sorted period transactions in recentTransactions for dashboard pagination", () => {
    const wallets = computeWalletsWithBalances(WALLETS_RAW, []);
    const manyTxs: TransactionDTO[] = Array.from({ length: 15 }, (_, idx) => ({
      id: `tx-${idx + 1}`,
      type: "expense",
      walletId: "w-bank",
      walletName: "KBank",
      walletType: "bank",
      toWalletId: null,
      toWalletName: null,
      categoryId: "c-food",
      categoryName: "อาหาร",
      categoryColor: "#f97316",
      amount: "100.00",
      transactionDate: `2026-11-${String(idx + 1).padStart(2, "0")}`,
      note: `รายการที่ ${idx + 1}`,
    }));

    const analytics = buildDashboardAnalytics({
      wallets,
      categories: CATEGORIES,
      transactions: manyTxs,
      selectedYear: 2026,
      selectedMonth: 11,
    });

    expect(analytics.recentTransactions).toHaveLength(15);
    expect(analytics.recentTransactions[0].id).toBe("tx-15");
    expect(analytics.recentTransactions[14].id).toBe("tx-1");
  });
});
