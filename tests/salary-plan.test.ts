import { describe, expect, it } from "vitest";
import {
  buildSalaryPlanSummary,
  computeRecommendedSalarySplits,
  computeWishlistMonthlyAmount,
} from "@/lib/salary-plan";
import type {
  SalaryAllocationDTO,
  SalarySettingsDTO,
  TransactionDTO,
  WalletDTO,
} from "@/lib/types";

const WALLETS: WalletDTO[] = [
  {
    id: "w-main",
    name: "KBank เงินเดือน",
    type: "bank",
    initialBalance: "5000.00",
    currentBalance: "35000.00",
    color: "#3b82f6",
    icon: "Landmark",
    isArchived: false,
  },
  {
    id: "w-cold",
    name: "บัญชีเงินเย็น",
    type: "bank",
    initialBalance: "20000.00",
    currentBalance: "25000.00",
    color: "#0ea5e9",
    icon: "PiggyBank",
    isArchived: false,
  },
  {
    id: "w-dca",
    name: "พอร์ต DCA",
    type: "bank",
    initialBalance: "10000.00",
    currentBalance: "10000.00",
    color: "#10b981",
    icon: "TrendingUp",
    isArchived: false,
  },
];

const SETTINGS: SalarySettingsDTO = {
  monthlySalary: "40000.00",
  payday: 1,
  salaryWalletId: "w-main",
};

const ALLOCATIONS: SalaryAllocationDTO[] = [
  {
    id: "a-cold",
    name: "เงินเย็นฉุกเฉิน",
    bucketType: "cold_money",
    mode: "fixed",
    value: "5000.00",
    targetTotal: null,
    targetMonths: null,
    linkedWalletId: "w-cold",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: "a-dca",
    name: "DCA กองทุนรวม",
    bucketType: "dca",
    mode: "percent",
    value: "10.00",
    targetTotal: null,
    targetMonths: null,
    linkedWalletId: "w-dca",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "a-wish",
    name: "ซื้อ iPad",
    bucketType: "wishlist",
    mode: "fixed",
    value: "2000.00",
    targetTotal: "24000.00",
    targetMonths: 12,
    linkedWalletId: null,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "a-inactive",
    name: "เป้าหมายที่ปิดไว้",
    bucketType: "other",
    mode: "fixed",
    value: "9999.00",
    targetTotal: null,
    targetMonths: null,
    linkedWalletId: null,
    sortOrder: 3,
    isActive: false,
  },
];

const TRANSACTIONS: TransactionDTO[] = [
  {
    id: "tx-exp-prev",
    type: "expense",
    walletId: "w-main",
    walletName: "KBank เงินเดือน",
    walletType: "bank",
    toWalletId: null,
    toWalletName: null,
    categoryId: "c-food",
    categoryName: "อาหาร",
    categoryColor: "#f97316",
    amount: "9000.00",
    transactionDate: "2026-11-10",
    note: "ค่าใช้จ่ายต้นเดือน",
  },
  {
    id: "tx-exp-today",
    type: "expense",
    walletId: "w-main",
    walletName: "KBank เงินเดือน",
    walletType: "bank",
    toWalletId: null,
    toWalletName: null,
    categoryId: "c-food",
    categoryName: "อาหาร",
    categoryColor: "#f97316",
    amount: "200.00",
    transactionDate: "2026-11-18",
    note: "ข้าวกลางวัน",
  },
  {
    id: "tx-transfer-cold",
    type: "transfer",
    walletId: "w-main",
    walletName: "KBank เงินเดือน",
    walletType: "bank",
    toWalletId: "w-cold",
    toWalletName: "บัญชีเงินเย็น",
    categoryId: null,
    categoryName: null,
    categoryColor: null,
    amount: "5000.00",
    transactionDate: "2026-11-01",
    note: "โอนเงินเย็นวันที่ 1",
  },
];

describe("salary plan calculation engine", () => {
  it("computes wishlist monthly target and recommended salary splits", () => {
    expect(computeWishlistMonthlyAmount("24000", 12)).toBe("2000.00");
    expect(computeWishlistMonthlyAmount("10000", 3)).toBe("3333.33");

    const splits = computeRecommendedSalarySplits("40000.00");
    expect(splits).toHaveLength(3);
    expect(splits[0]).toMatchObject({
      id: "balanced",
      coldMoneyAmount: "4000.00",
      dcaAmount: "4000.00",
      wishlistAmount: "2000.00",
      spendableAmount: "30000.00",
    });
  });

  it("computes spendable budget, remaining balance, daily allowance, and transfer progress", () => {
    // 2026-11-18 14:00 ICT -> 2026-11-18 07:00 UTC. November has 30 days -> 13 days left (18..30).
    const now = new Date("2026-11-18T07:00:00.000Z");

    const summary = buildSalaryPlanSummary({
      settings: SETTINGS,
      allocations: ALLOCATIONS,
      wallets: WALLETS,
      transactions: TRANSACTIONS,
      selectedYear: 2026,
      selectedMonth: 11,
      now,
    });

    // Active allocations: 5000 (cold) + 4000 (10% of 40000) + 2000 (wishlist) = 11000.00
    expect(summary.totalAllocated).toBe("11000.00");
    expect(summary.spendableBudget).toBe("29000.00");
    expect(summary.periodExpense).toBe("9200.00");
    // Remaining to spend = 29000 - 9200 = 19800.00
    expect(summary.remainingToSpend).toBe("19800.00");
    expect(summary.isOverAllocated).toBe(false);
    expect(summary.daysInMonth).toBe(30);
    expect(summary.daysRemaining).toBe(13);

    // Remaining before today = 19800 + 200 = 20000; 20000 / 13 = 1538.46
    expect(summary.todayExpense).toBe("200.00");
    expect(summary.todayBudget).toBe("1538.46");
    expect(summary.todayRemaining).toBe("1338.46");
    // Daily allowance from current remaining: 19800 / 13 = 1523.08
    expect(summary.dailyAllowance).toBe("1523.08");

    // Cold money was transferred (5000/5000), DCA still pending (0/4000)
    const cold = summary.allocations.find((a) => a.id === "a-cold");
    const dca = summary.allocations.find((a) => a.id === "a-dca");
    expect(cold?.isCompletedThisMonth).toBe(true);
    expect(cold?.pendingTransfer).toBe("0.00");
    expect(dca?.monthlyAmount).toBe("4000.00");
    expect(dca?.isCompletedThisMonth).toBe(false);
    expect(dca?.pendingTransfer).toBe("4000.00");
    expect(summary.pendingTransferTotal).toBe("4000.00");
    expect(summary.pendingTransferCount).toBe(1);
  });

  it("flags over-allocated salary plans cleanly", () => {
    const overSettings: SalarySettingsDTO = {
      monthlySalary: "10000.00",
      payday: 1,
      salaryWalletId: "w-main",
    };
    const summary = buildSalaryPlanSummary({
      settings: overSettings,
      allocations: ALLOCATIONS,
      wallets: WALLETS,
      transactions: [],
      selectedYear: 2026,
      selectedMonth: 11,
      now: new Date("2026-11-18T07:00:00.000Z"),
    });

    // 5000 + 1000 (10%) + 2000 = 8000 <= 10000 -> wait let's test when salary is 6000!
    expect(summary.isOverAllocated).toBe(false);

    const lowerSalarySummary = buildSalaryPlanSummary({
      settings: { ...overSettings, monthlySalary: "6000.00" },
      allocations: ALLOCATIONS,
      wallets: WALLETS,
      transactions: [],
      selectedYear: 2026,
      selectedMonth: 11,
      now: new Date("2026-11-18T07:00:00.000Z"),
    });
    // 5000 + 600 + 2000 = 7600 > 6000
    expect(lowerSalarySummary.isOverAllocated).toBe(true);
    expect(lowerSalarySummary.spendableBudget).toBe("-1600.00");
    expect(lowerSalarySummary.dailyAllowance).toBe("0.00");
  });

  it("supports custom payday cycle (e.g. payday 25) and calculates cycle dates and remaining days", () => {
    const payday25Settings: SalarySettingsDTO = {
      monthlySalary: "40000.00",
      payday: 25,
      salaryWalletId: "w-main",
    };
    const cycleTx: TransactionDTO[] = [
      {
        ...TRANSACTIONS[0],
        id: "tx-oct",
        amount: "3000.00",
        transactionDate: "2026-10-28",
      },
      {
        ...TRANSACTIONS[1],
        id: "tx-nov-today",
        amount: "500.00",
        transactionDate: "2026-11-18",
      },
    ];

    // On 2026-11-18 ICT, Nov payday-25 cycle is 2026-10-25..2026-11-24 (31 days, 7 days remaining: 18..24)
    const now = new Date("2026-11-18T07:00:00.000Z");
    const summary = buildSalaryPlanSummary({
      settings: payday25Settings,
      allocations: ALLOCATIONS,
      wallets: WALLETS,
      transactions: cycleTx,
      selectedYear: 2026,
      selectedMonth: 11,
      now,
    });

    expect(summary.cycleStartDate).toBe("2026-10-25");
    expect(summary.cycleEndDate).toBe("2026-11-24");
    expect(summary.daysInMonth).toBe(31);
    expect(summary.daysRemaining).toBe(7);
    expect(summary.periodExpense).toBe("3500.00");
    // Spendable = 40000 - 11000 = 29000; Remaining = 29000 - 3500 = 25500
    expect(summary.remainingToSpend).toBe("25500.00");
    // 25500 / 7 = 3642.86
    expect(summary.dailyAllowance).toBe("3642.86");
  });

  it("supports extraIncome-only plans (e.g. part-time 2500 before full-time work starts) and combined salary + extraIncome", () => {
    // 2026-11-18 ICT -> 13 days left in November (18..30)
    const now = new Date("2026-11-18T07:00:00.000Z");

    const partTimeOnlySettings: SalarySettingsDTO = {
      monthlySalary: "0.00",
      extraIncome: "2500.00",
      payday: 1,
      salaryWalletId: "w-main",
    };

    const partTimeAllocs: SalaryAllocationDTO[] = [
      {
        id: "a-pt-dca",
        name: "DCA",
        bucketType: "dca",
        mode: "percent",
        value: "10.00",
        targetTotal: null,
        targetMonths: null,
        linkedWalletId: null,
        sortOrder: 0,
        isActive: true,
      },
      {
        id: "a-pt-wish",
        name: "ของที่อยากได้",
        bucketType: "wishlist",
        mode: "fixed",
        value: "500.00",
        targetTotal: null,
        targetMonths: null,
        linkedWalletId: "w-cold",
        sortOrder: 1,
        isActive: true,
      },
    ];

    const partTimeSummary = buildSalaryPlanSummary({
      settings: partTimeOnlySettings,
      allocations: partTimeAllocs,
      wallets: WALLETS,
      transactions: [],
      selectedYear: 2026,
      selectedMonth: 11,
      now,
    });

    expect(partTimeSummary.hasSalaryConfigured).toBe(true);
    expect(partTimeSummary.monthlySalary).toBe("0.00");
    expect(partTimeSummary.extraIncome).toBe("2500.00");
    expect(partTimeSummary.totalPlannedIncome).toBe("2500.00");
    // 10% of 2500 = 250.00; + 500.00 fixed = 750.00 (30%)
    expect(partTimeSummary.totalAllocated).toBe("750.00");
    expect(partTimeSummary.allocationRatioPct).toBe(30);
    expect(partTimeSummary.spendableBudget).toBe("1750.00");
    expect(partTimeSummary.dailyAllowance).toBe("134.62");

    // Next month: full-time salary 25,000 + part-time 2,500 = 27,500 total
    const combinedSummary = buildSalaryPlanSummary({
      settings: {
        ...partTimeOnlySettings,
        monthlySalary: "25000.00",
      },
      allocations: partTimeAllocs,
      wallets: WALLETS,
      transactions: [],
      selectedYear: 2026,
      selectedMonth: 11,
      now,
    });
    expect(combinedSummary.totalPlannedIncome).toBe("27500.00");
    // 10% of 27500 = 2750; + 500 = 3250
    expect(combinedSummary.totalAllocated).toBe("3250.00");
    expect(combinedSummary.spendableBudget).toBe("24250.00");
  });
});
