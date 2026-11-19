import Decimal from "decimal.js";
import { getMonthDateRange } from "./date";
import { computeRecordingStreak } from "./streak";
import {
  computeNetWorthSummary,
  computeWalletBalance,
  formatFixed2,
  toChartNumber,
  toDecimal,
} from "./decimal";
import type {
  BudgetStatusPoint,
  CategoryBreakdownPoint,
  CategoryDTO,
  DashboardAnalytics,
  MonthlyChartPoint,
  TransactionDTO,
  TransactionFilterParams,
  WalletDTO,
} from "./types";

const THAI_SHORT_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function formatMonthShortLabel(year: number, month: number): string {
  const shortYear = String(year + 543).slice(-2);
  return `${THAI_SHORT_MONTHS[month - 1]} ${shortYear}`;
}

export function computeWalletsWithBalances(
  wallets: Array<Omit<WalletDTO, "currentBalance">>,
  transactions: TransactionDTO[]
): WalletDTO[] {
  const totalsByWallet = new Map<
    string,
    { income: Decimal; expense: Decimal; transferIn: Decimal; transferOut: Decimal }
  >();

  for (const w of wallets) {
    totalsByWallet.set(w.id, {
      income: new Decimal(0),
      expense: new Decimal(0),
      transferIn: new Decimal(0),
      transferOut: new Decimal(0),
    });
  }

  for (const tx of transactions) {
    const amount = toDecimal(tx.amount);
    const source = totalsByWallet.get(tx.walletId);

    if (source) {
      if (tx.type === "income") {
        source.income = source.income.plus(amount);
      } else if (tx.type === "expense") {
        source.expense = source.expense.plus(amount);
      } else if (tx.type === "transfer") {
        source.transferOut = source.transferOut.plus(amount);
      }
    }

    if (tx.type === "transfer" && tx.toWalletId) {
      const target = totalsByWallet.get(tx.toWalletId);
      if (target) {
        target.transferIn = target.transferIn.plus(amount);
      }
    }
  }

  return wallets.map((wallet) => {
    const totals = totalsByWallet.get(wallet.id);
    const balance = computeWalletBalance({
      initialBalance: wallet.initialBalance,
      incomeTotal: totals?.income ?? 0,
      expenseTotal: totals?.expense ?? 0,
      transferInTotal: totals?.transferIn ?? 0,
      transferOutTotal: totals?.transferOut ?? 0,
    });

    return {
      ...wallet,
      currentBalance: formatFixed2(balance),
    };
  });
}

export function filterTransactionsList(
  transactions: TransactionDTO[],
  filters: TransactionFilterParams
): TransactionDTO[] {
  const query = filters.q?.trim().toLowerCase() ?? "";

  return transactions.filter((tx) => {
    if (filters.type && filters.type !== "all" && tx.type !== filters.type) {
      return false;
    }

    if (filters.walletId && filters.walletId !== "all") {
      const matchesWallet =
        tx.walletId === filters.walletId || tx.toWalletId === filters.walletId;
      if (!matchesWallet) return false;
    }

    if (filters.categoryId && filters.categoryId !== "all") {
      if (tx.categoryId !== filters.categoryId) return false;
    }

    if (filters.startDate && tx.transactionDate < filters.startDate) {
      return false;
    }

    if (filters.endDate && tx.transactionDate > filters.endDate) {
      return false;
    }

    if (query) {
      const haystacks = [
        tx.note ?? "",
        tx.categoryName ?? "",
        tx.walletName,
        tx.toWalletName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystacks.includes(query)) return false;
    }

    return true;
  });
}

export function getTrailingMonths(
  year: number,
  month: number,
  count: number = 6
): Array<{ year: number; month: number; monthKey: string; label: string }> {
  const result: Array<{
    year: number;
    month: number;
    monthKey: string;
    label: string;
  }> = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    let targetYear = year;
    let targetMonth = month - offset;
    while (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }
    const monthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
    result.push({
      year: targetYear,
      month: targetMonth,
      monthKey,
      label: formatMonthShortLabel(targetYear, targetMonth),
    });
  }

  return result;
}

export function buildDashboardAnalytics(params: {
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  selectedYear: number;
  selectedMonth: number;
}): DashboardAnalytics {
  const { wallets, categories, transactions, selectedYear, selectedMonth } =
    params;
  const { startDate, endDate } = getMonthDateRange(selectedYear, selectedMonth);

  const netWorth = computeNetWorthSummary(
    wallets
      .filter((w) => !w.isArchived)
      .map((w) => ({ type: w.type, balance: w.currentBalance }))
  );

  let periodIncome = new Decimal(0);
  let periodExpense = new Decimal(0);
  let periodTransfer = new Decimal(0);

  const categoryTotals = new Map<string, Decimal>();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const periodTransactions = transactions.filter(
    (tx) => tx.transactionDate >= startDate && tx.transactionDate <= endDate
  );

  for (const tx of periodTransactions) {
    const amount = toDecimal(tx.amount);
    if (tx.type === "income") {
      periodIncome = periodIncome.plus(amount);
    } else if (tx.type === "expense") {
      periodExpense = periodExpense.plus(amount);
      if (tx.categoryId) {
        categoryTotals.set(
          tx.categoryId,
          (categoryTotals.get(tx.categoryId) ?? new Decimal(0)).plus(amount)
        );
      }
    } else if (tx.type === "transfer") {
      periodTransfer = periodTransfer.plus(amount);
    }
  }

  const expenseByCategory: CategoryBreakdownPoint[] = Array.from(
    categoryTotals.entries()
  )
    .map(([categoryId, total]) => {
      const cat = categoryMap.get(categoryId);
      const pct = periodExpense.gt(0)
        ? total.div(periodExpense).times(100).toDecimalPlaces(1).toNumber()
        : 0;
      return {
        categoryId,
        name: cat?.name ?? "ไม่ระบุหมวดหมู่",
        color: cat?.color ?? "#64748b",
        amount: formatFixed2(total),
        chartValue: toChartNumber(total),
        percentage: pct,
      };
    })
    .sort((a, b) => b.chartValue - a.chartValue);

  const trailingMonths = getTrailingMonths(selectedYear, selectedMonth, 6);
  const monthlyBucket = new Map<
    string,
    { income: Decimal; expense: Decimal }
  >();

  for (const m of trailingMonths) {
    monthlyBucket.set(m.monthKey, {
      income: new Decimal(0),
      expense: new Decimal(0),
    });
  }

  for (const tx of transactions) {
    const monthKey = tx.transactionDate.slice(0, 7);
    const bucket = monthlyBucket.get(monthKey);
    if (!bucket) continue;
    const amount = toDecimal(tx.amount);
    if (tx.type === "income") {
      bucket.income = bucket.income.plus(amount);
    } else if (tx.type === "expense") {
      bucket.expense = bucket.expense.plus(amount);
    }
  }

  const monthlyTrend: MonthlyChartPoint[] = trailingMonths.map((m) => {
    const bucket = monthlyBucket.get(m.monthKey)!;
    return {
      monthKey: m.monthKey,
      label: m.label,
      income: toChartNumber(bucket.income),
      expense: toChartNumber(bucket.expense),
    };
  });

  const sortedRecent = [...periodTransactions].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate)
  );

  const budgetStatuses: BudgetStatusPoint[] = categories
    .filter(
      (c) =>
        c.type === "expense" &&
        !c.isArchived &&
        c.monthlyBudget !== null &&
        toDecimal(c.monthlyBudget).gt(0)
    )
    .map((c) => {
      const budgetDec = toDecimal(c.monthlyBudget!);
      const spentDec = categoryTotals.get(c.id) ?? new Decimal(0);
      const remainingDec = budgetDec.minus(spentDec);
      const pct = budgetDec.gt(0)
        ? spentDec.div(budgetDec).times(100).toDecimalPlaces(1).toNumber()
        : 0;
      return {
        categoryId: c.id,
        name: c.name,
        color: c.color ?? "#64748b",
        budget: formatFixed2(budgetDec),
        spent: formatFixed2(spentDec),
        remaining: formatFixed2(remainingDec),
        percentage: pct,
        isOverBudget: spentDec.gt(budgetDec),
        isNearLimit: !spentDec.gt(budgetDec) && pct >= 80,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  const streak = computeRecordingStreak(
    transactions.map((tx) => tx.transactionDate)
  );

  return {
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    periodIncome: formatFixed2(periodIncome),
    periodExpense: formatFixed2(periodExpense),
    periodNet: formatFixed2(periodIncome.minus(periodExpense)),
    periodTransfer: formatFixed2(periodTransfer),
    ...netWorth,
    expenseByCategory,
    budgetStatuses,
    monthlyTrend,
    recentTransactions: sortedRecent,
    streak,
  };
}
