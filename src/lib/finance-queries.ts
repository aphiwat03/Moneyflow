import "server-only";
import Decimal from "decimal.js";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  categories,
  investmentDcaLogs,
  investmentHoldings,
  investmentSettings,
  investmentSnapshots,
  salaryAllocations,
  salarySettings,
  transactions,
  wallets,
} from "@/db/schema";
import { escapeSqlLikePattern } from "./auth-policy";
import {
  buildDashboardAnalytics,
  getTrailingMonths,
} from "./dashboard-analytics";
import {
  compareTransactionsByDateTimeDesc,
  getBangkokToday,
  getBangkokYearMonth,
  getMonthDateRange,
  getPaydayCycleDateRange,
} from "./date";
import { computeWalletBalance, formatFixed2, toDecimal } from "./decimal";
import { buildSalaryPlanSummary } from "./salary-plan";
import type {
  CategoryDTO,
  DashboardAnalytics,
  InvestmentDcaLogDTO,
  InvestmentHoldingDTO,
  InvestmentPlanSettingsDTO,
  InvestmentSnapshotDTO,
  SalaryAllocationDTO,
  SalaryPlanSummary,
  SalarySettingsDTO,
  TransactionDTO,
  TransactionFilterParams,
  WalletDTO,
} from "./types";

export async function getUserWalletsWithBalances(
  userId: string
): Promise<WalletDTO[]> {
  const [walletRows, flowRows] = await Promise.all([
    db
      .select({
        id: wallets.id,
        name: wallets.name,
        type: wallets.type,
        initialBalance: wallets.initialBalance,
        color: wallets.color,
        icon: wallets.icon,
        isArchived: wallets.isArchived,
      })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .orderBy(wallets.isArchived, wallets.createdAt),
    db
      .select({
        walletId: transactions.walletId,
        toWalletId: transactions.toWalletId,
        type: transactions.type,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(
        transactions.walletId,
        transactions.toWalletId,
        transactions.type
      ),
  ]);

  const flowByWallet = new Map<
    string,
    {
      income: Decimal;
      expense: Decimal;
      transferIn: Decimal;
      transferOut: Decimal;
    }
  >();

  const getBucket = (id: string) => {
    let bucket = flowByWallet.get(id);
    if (!bucket) {
      bucket = {
        income: new Decimal(0),
        expense: new Decimal(0),
        transferIn: new Decimal(0),
        transferOut: new Decimal(0),
      };
      flowByWallet.set(id, bucket);
    }
    return bucket;
  };

  for (const flow of flowRows) {
    const amount = toDecimal(flow.total);
    const source = getBucket(flow.walletId);
    if (flow.type === "income") {
      source.income = source.income.plus(amount);
    } else if (flow.type === "expense") {
      source.expense = source.expense.plus(amount);
    } else if (flow.type === "transfer") {
      source.transferOut = source.transferOut.plus(amount);
      if (flow.toWalletId) {
        const dest = getBucket(flow.toWalletId);
        dest.transferIn = dest.transferIn.plus(amount);
      }
    }
  }

  return walletRows.map((wallet) => {
    const bucket = flowByWallet.get(wallet.id);
    const balance = computeWalletBalance({
      initialBalance: wallet.initialBalance,
      incomeTotal: bucket?.income ?? 0,
      expenseTotal: bucket?.expense ?? 0,
      transferInTotal: bucket?.transferIn ?? 0,
      transferOutTotal: bucket?.transferOut ?? 0,
    });

    return {
      ...wallet,
      currentBalance: formatFixed2(balance),
    };
  });
}

export async function getUserCategories(userId: string): Promise<CategoryDTO[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      monthlyBudget: categories.monthlyBudget,
      color: categories.color,
      icon: categories.icon,
      isDefault: categories.isDefault,
      isArchived: categories.isArchived,
    })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.isArchived, categories.type, categories.name);
}

export async function getUserTransactions(
  userId: string,
  filters: TransactionFilterParams = {}
): Promise<TransactionDTO[]> {
  const fromWallet = alias(wallets, "from_wallet");
  const toWallet = alias(wallets, "to_wallet");

  const conditions = [eq(transactions.userId, userId)];

  if (filters.type && filters.type !== "all") {
    conditions.push(eq(transactions.type, filters.type));
  }
  if (filters.walletId && filters.walletId !== "all") {
    const matchWallet = or(
      eq(transactions.walletId, filters.walletId),
      eq(transactions.toWalletId, filters.walletId)
    );
    if (matchWallet) conditions.push(matchWallet);
  }
  if (filters.categoryId && filters.categoryId !== "all") {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.tag && filters.tag !== "all") {
    conditions.push(eq(transactions.tag, filters.tag));
  }
  if (filters.startDate) {
    conditions.push(gte(transactions.transactionDate, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(transactions.transactionDate, filters.endDate));
  }
  if (filters.q?.trim()) {
    const pattern = `%${escapeSqlLikePattern(filters.q.trim())}%`;
    const matchQuery = or(
      ilike(transactions.note, pattern),
      ilike(transactions.tag, pattern),
      ilike(transactions.recipientName, pattern),
      ilike(transactions.recipientBank, pattern),
      ilike(transactions.recipientAccount, pattern),
      ilike(categories.name, pattern),
      ilike(fromWallet.name, pattern),
      ilike(toWallet.name, pattern)
    );
    if (matchQuery) conditions.push(matchQuery);
  }

  const baseQuery = db
    .select({
      id: transactions.id,
      type: transactions.type,
      walletId: transactions.walletId,
      walletName: fromWallet.name,
      walletType: fromWallet.type,
      toWalletId: transactions.toWalletId,
      toWalletName: toWallet.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      transactionTime: transactions.transactionTime,
      createdAt: transactions.createdAt,
      note: transactions.note,
      tag: transactions.tag,
      recipientName: transactions.recipientName,
      recipientBank: transactions.recipientBank,
      recipientAccount: transactions.recipientAccount,
    })
    .from(transactions)
    .innerJoin(
      fromWallet,
      and(
        eq(transactions.walletId, fromWallet.id),
        eq(transactions.userId, fromWallet.userId)
      )
    )
    .leftJoin(
      toWallet,
      and(
        eq(transactions.toWalletId, toWallet.id),
        eq(transactions.userId, toWallet.userId)
      )
    )
    .leftJoin(
      categories,
      and(
        eq(transactions.categoryId, categories.id),
        eq(transactions.userId, categories.userId)
      )
    )
    .where(and(...conditions))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));

  const rows =
    typeof filters.limit === "number" && filters.limit > 0
      ? await baseQuery.limit(filters.limit)
      : await baseQuery;

  return rows
    .map((row) => ({
      ...row,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    }))
    .sort(compareTransactionsByDateTimeDesc);
}

export async function getUserSalaryConfig(userId: string): Promise<{
  settings: SalarySettingsDTO | null;
  allocations: SalaryAllocationDTO[];
}> {
  const [settingsRows, allocationRows] = await Promise.all([
    db
      .select({
        monthlySalary: salarySettings.monthlySalary,
        extraIncome: salarySettings.extraIncome,
        payday: salarySettings.payday,
        salaryWalletId: salarySettings.salaryWalletId,
      })
      .from(salarySettings)
      .where(eq(salarySettings.userId, userId))
      .limit(1),
    db
      .select({
        id: salaryAllocations.id,
        name: salaryAllocations.name,
        bucketType: salaryAllocations.bucketType,
        mode: salaryAllocations.mode,
        value: salaryAllocations.value,
        targetTotal: salaryAllocations.targetTotal,
        targetMonths: salaryAllocations.targetMonths,
        linkedWalletId: salaryAllocations.linkedWalletId,
        sortOrder: salaryAllocations.sortOrder,
        isActive: salaryAllocations.isActive,
      })
      .from(salaryAllocations)
      .where(eq(salaryAllocations.userId, userId))
      .orderBy(asc(salaryAllocations.sortOrder), asc(salaryAllocations.createdAt)),
  ]);

  return {
    settings: settingsRows[0] ?? null,
    allocations: allocationRows,
  };
}

export async function getUserDashboardData(
  userId: string,
  targetYear?: number,
  targetMonth?: number
): Promise<{
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  analytics: DashboardAnalytics;
  salaryPlan: SalaryPlanSummary;
}> {
  const bangkokNow = getBangkokYearMonth();
  const todayIso = getBangkokToday();
  const selectedYear = targetYear ?? bangkokNow.year;
  const selectedMonth = targetMonth ?? bangkokNow.month;

  const trailing = getTrailingMonths(selectedYear, selectedMonth, 6);
  const firstMonthRange = getMonthDateRange(trailing[0].year, trailing[0].month);
  const lastMonthRange = getMonthDateRange(selectedYear, selectedMonth);

  const [userWallets, userCategories, salaryConfig] = await Promise.all([
    getUserWalletsWithBalances(userId),
    getUserCategories(userId),
    getUserSalaryConfig(userId),
  ]);

  const cycleRange = getPaydayCycleDateRange(
    selectedYear,
    selectedMonth,
    salaryConfig.settings?.payday ?? 1
  );
  const windowStart =
    firstMonthRange.startDate < cycleRange.startDate
      ? firstMonthRange.startDate
      : cycleRange.startDate;
  const windowEnd =
    lastMonthRange.endDate > cycleRange.endDate
      ? lastMonthRange.endDate
      : cycleRange.endDate;

  const needsSeparateTodayQuery = todayIso < windowStart || todayIso > windowEnd;

  const [windowTransactions, todayTransactions] = await Promise.all([
    getUserTransactions(userId, {
      startDate: windowStart,
      endDate: windowEnd,
    }),
    needsSeparateTodayQuery
      ? getUserTransactions(userId, {
          startDate: todayIso,
          endDate: todayIso,
        })
      : Promise.resolve([] as TransactionDTO[]),
  ]);

  const analytics = buildDashboardAnalytics({
    wallets: userWallets,
    categories: userCategories,
    transactions: windowTransactions,
    selectedYear,
    selectedMonth,
  });

  const transactionsForPlan = needsSeparateTodayQuery
    ? [...windowTransactions, ...todayTransactions]
    : windowTransactions;

  const salaryPlan = buildSalaryPlanSummary({
    settings: salaryConfig.settings,
    allocations: salaryConfig.allocations,
    wallets: userWallets,
    transactions: transactionsForPlan,
    selectedYear,
    selectedMonth,
  });

  return {
    wallets: userWallets,
    categories: userCategories,
    analytics,
    salaryPlan,
  };
}

export async function getUserPlanPageData(
  userId: string,
  targetYear?: number,
  targetMonth?: number
): Promise<{
  wallets: WalletDTO[];
  settings: SalarySettingsDTO | null;
  allocations: SalaryAllocationDTO[];
  summary: SalaryPlanSummary;
}> {
  const bangkokNow = getBangkokYearMonth();
  const todayIso = getBangkokToday();
  const selectedYear = targetYear ?? bangkokNow.year;
  const selectedMonth = targetMonth ?? bangkokNow.month;

  const [userWallets, salaryConfig] = await Promise.all([
    getUserWalletsWithBalances(userId),
    getUserSalaryConfig(userId),
  ]);

  const { startDate, endDate } = getPaydayCycleDateRange(
    selectedYear,
    selectedMonth,
    salaryConfig.settings?.payday ?? 1
  );
  const needsSeparateTodayQuery = todayIso < startDate || todayIso > endDate;

  const [monthTransactions, todayTransactions] = await Promise.all([
    getUserTransactions(userId, { startDate, endDate }),
    needsSeparateTodayQuery
      ? getUserTransactions(userId, { startDate: todayIso, endDate: todayIso })
      : Promise.resolve([] as TransactionDTO[]),
  ]);

  const transactionsForPlan = needsSeparateTodayQuery
    ? [...monthTransactions, ...todayTransactions]
    : monthTransactions;

  const summary = buildSalaryPlanSummary({
    settings: salaryConfig.settings,
    allocations: salaryConfig.allocations,
    wallets: userWallets,
    transactions: transactionsForPlan,
    selectedYear,
    selectedMonth,
  });

  return {
    wallets: userWallets,
    settings: salaryConfig.settings,
    allocations: salaryConfig.allocations,
    summary,
  };
}

export async function getUserInvestmentPageData(
  userId: string
): Promise<{
  settings: InvestmentPlanSettingsDTO | null;
  holdings: InvestmentHoldingDTO[];
  snapshots: InvestmentSnapshotDTO[];
  dcaLogs: InvestmentDcaLogDTO[];
  wallets: WalletDTO[];
  incomeCategories: CategoryDTO[];
  linkedInvestmentWalletTotal: string;
  linkedInvestmentWalletCount: number;
  linkedPlanDcaMonthly: string;
}> {
  const { year, month } = getBangkokYearMonth();

  const [
    planData,
    userCategories,
    settingsRows,
    holdingRows,
    snapshotRows,
    dcaLogRows,
  ] = await Promise.all([
    getUserPlanPageData(userId, year, month),
    getUserCategories(userId),
    db
      .select({
        targetGoalAmount: investmentSettings.targetGoalAmount,
        startingPrincipal: investmentSettings.startingPrincipal,
        monthlyDca: investmentSettings.monthlyDca,
        expectedAnnualReturnPct: investmentSettings.expectedAnnualReturnPct,
        horizonYears: investmentSettings.horizonYears,
        annualDcaStepUpPct: investmentSettings.annualDcaStepUpPct,
        reinvestDividends: investmentSettings.reinvestDividends,
      })
      .from(investmentSettings)
      .where(eq(investmentSettings.userId, userId))
      .limit(1),
    db
      .select({
        id: investmentHoldings.id,
        symbol: investmentHoldings.symbol,
        name: investmentHoldings.name,
        assetType: investmentHoldings.assetType,
        targetAllocationPct: investmentHoldings.targetAllocationPct,
        expectedAnnualReturnPct: investmentHoldings.expectedAnnualReturnPct,
        investedCost: investmentHoldings.investedCost,
        currentValue: investmentHoldings.currentValue,
        dividendsReceived: investmentHoldings.dividendsReceived,
        units: investmentHoldings.units,
        currency: investmentHoldings.currency,
        broker: investmentHoldings.broker,
        note: investmentHoldings.note,
        color: investmentHoldings.color,
        sortOrder: investmentHoldings.sortOrder,
      })
      .from(investmentHoldings)
      .where(eq(investmentHoldings.userId, userId))
      .orderBy(asc(investmentHoldings.sortOrder), asc(investmentHoldings.createdAt)),
    db
      .select({
        id: investmentSnapshots.id,
        monthKey: investmentSnapshots.monthKey,
        investedCost: investmentSnapshots.investedCost,
        marketValue: investmentSnapshots.marketValue,
        dividends: investmentSnapshots.dividends,
        note: investmentSnapshots.note,
      })
      .from(investmentSnapshots)
      .where(eq(investmentSnapshots.userId, userId))
      .orderBy(desc(investmentSnapshots.monthKey)),
    db
      .select({
        id: investmentDcaLogs.id,
        holdingId: investmentDcaLogs.holdingId,
        holdingSymbol: investmentHoldings.symbol,
        holdingName: investmentHoldings.name,
        transactionId: investmentDcaLogs.transactionId,
        executedDate: investmentDcaLogs.executedDate,
        amountThb: investmentDcaLogs.amountThb,
        unitsBought: investmentDcaLogs.unitsBought,
        pricePerUnit: investmentDcaLogs.pricePerUnit,
        feeThb: investmentDcaLogs.feeThb,
        note: investmentDcaLogs.note,
      })
      .from(investmentDcaLogs)
      .innerJoin(
        investmentHoldings,
        eq(investmentDcaLogs.holdingId, investmentHoldings.id)
      )
      .where(eq(investmentDcaLogs.userId, userId))
      .orderBy(desc(investmentDcaLogs.executedDate), desc(investmentDcaLogs.createdAt))
      .limit(120),
  ]);

  const investmentWallets = planData.wallets.filter(
    (w) => !w.isArchived && w.type === "investment"
  );
  const linkedInvestmentWalletTotal = formatFixed2(
    investmentWallets.reduce(
      (sum, w) => sum.plus(toDecimal(w.currentBalance)),
      new Decimal(0)
    )
  );

  const settingsRow = settingsRows[0];
  const settings: InvestmentPlanSettingsDTO | null = settingsRow
    ? {
        targetGoalAmount: settingsRow.targetGoalAmount,
        startingPrincipal: settingsRow.startingPrincipal,
        monthlyDca: settingsRow.monthlyDca,
        expectedAnnualReturnPct: Number(settingsRow.expectedAnnualReturnPct),
        horizonYears: settingsRow.horizonYears,
        annualDcaStepUpPct: Number(settingsRow.annualDcaStepUpPct),
        reinvestDividends: settingsRow.reinvestDividends,
      }
    : null;

  const holdings: InvestmentHoldingDTO[] = holdingRows.map((h) => ({
    ...h,
    targetAllocationPct: Number(h.targetAllocationPct),
    expectedAnnualReturnPct: Number(h.expectedAnnualReturnPct),
  }));

  return {
    settings,
    holdings,
    snapshots: snapshotRows,
    dcaLogs: dcaLogRows,
    wallets: planData.wallets.filter((w) => !w.isArchived),
    incomeCategories: userCategories.filter(
      (c) => !c.isArchived && c.type === "income"
    ),
    linkedInvestmentWalletTotal,
    linkedInvestmentWalletCount: investmentWallets.length,
    linkedPlanDcaMonthly: planData.summary.bucketTotals.dca,
  };
}
