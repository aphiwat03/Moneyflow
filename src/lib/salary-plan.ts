import Decimal from "decimal.js";
import {
  getBangkokToday,
  getPaydayCycleDateRange,
} from "./date";

function parseIsoToUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
import { formatFixed2, toDecimal } from "./decimal";
import type {
  ComputedAllocationItem,
  PlanBucketType,
  SalaryAllocationDTO,
  SalaryPlanSummary,
  SalarySettingsDTO,
  TransactionDTO,
  WalletDTO,
} from "./types";

export const PLAN_BUCKET_META: Record<
  PlanBucketType,
  { label: string; shortLabel: string; description: string; color: string }
> = {
  cold_money: {
    label: "เงินเย็น (ออมสำรอง)",
    shortLabel: "เงินเย็น",
    description: "เงินสำรองฉุกเฉินหรือเงินออมระยะยาวที่ไม่แตะต้อง",
    color: "#0ea5e9",
  },
  dca: {
    label: "ลงทุน DCA รายเดือน",
    shortLabel: "DCA",
    description: "ลงทุนสม่ำเสมอทุกเดือนในกองทุน หุ้น หรือสินทรัพย์",
    color: "#10b981",
  },
  wishlist: {
    label: "ของที่อยากได้ (Wishlist)",
    shortLabel: "ของที่อยากได้",
    description: "ทยอยเก็บรายเดือนตามราคาเป้าหมายและระยะเวลาที่ตั้งไว้",
    color: "#f97316",
  },
  other: {
    label: "เป้าหมายอื่นๆ",
    shortLabel: "อื่นๆ",
    description: "งบท่องเที่ยว ประกัน หรือเป้าหมายเฉพาะกิจ",
    color: "#8b5cf6",
  },
};

export interface RecommendedStrategy {
  id: "balanced" | "conservative" | "aggressive_invest";
  title: string;
  subtitle: string;
  coldMoneyPct: number;
  dcaPct: number;
  wishlistPct: number;
  spendablePct: number;
  coldMoneyAmount: string;
  dcaAmount: string;
  wishlistAmount: string;
  spendableAmount: string;
  dailySpendableEstimate: string;
}

export function computeWishlistMonthlyAmount(
  targetTotal: string | number | Decimal,
  targetMonths: number
): string {
  if (!Number.isInteger(targetMonths) || targetMonths <= 0) {
    return "0.00";
  }
  const totalDec = toDecimal(targetTotal);
  if (totalDec.lte(0)) return "0.00";
  return formatFixed2(
    totalDec.div(targetMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  );
}

export function computeRecommendedSalarySplits(
  monthlySalary: string | number | Decimal
): RecommendedStrategy[] {
  const salaryDec = toDecimal(monthlySalary);
  const presets: Array<{
    id: RecommendedStrategy["id"];
    title: string;
    subtitle: string;
    coldMoneyPct: number;
    dcaPct: number;
    wishlistPct: number;
  }> = [
    {
      id: "balanced",
      title: "สายสมดุล (ออม + ลงทุน 25%)",
      subtitle: "เก็บเงินเย็น 10% • DCA 10% • ของที่อยากได้ 5% • เหลือใช้ 75%",
      coldMoneyPct: 10,
      dcaPct: 10,
      wishlistPct: 5,
    },
    {
      id: "conservative",
      title: "สายมั่นคงเน้นเงินเย็น (ออม + ลงทุน 30%)",
      subtitle: "เก็บเงินเย็น 15% • DCA 10% • ของที่อยากได้ 5% • เหลือใช้ 70%",
      coldMoneyPct: 15,
      dcaPct: 10,
      wishlistPct: 5,
    },
    {
      id: "aggressive_invest",
      title: "สายเร่งลงทุน DCA (ออม + ลงทุน 40%)",
      subtitle: "เก็บเงินเย็น 15% • DCA 20% • ของที่อยากได้ 5% • เหลือใช้ 60%",
      coldMoneyPct: 15,
      dcaPct: 20,
      wishlistPct: 5,
    },
  ];

  return presets.map((p) => {
    const spendablePct = 100 - (p.coldMoneyPct + p.dcaPct + p.wishlistPct);
    const cold = salaryDec
      .times(p.coldMoneyPct)
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const dca = salaryDec
      .times(p.dcaPct)
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const wishlist = salaryDec
      .times(p.wishlistPct)
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const spendable = salaryDec.minus(cold).minus(dca).minus(wishlist);
    const daily = spendable.gt(0)
      ? spendable.div(30).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    return {
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      coldMoneyPct: p.coldMoneyPct,
      dcaPct: p.dcaPct,
      wishlistPct: p.wishlistPct,
      spendablePct,
      coldMoneyAmount: formatFixed2(cold),
      dcaAmount: formatFixed2(dca),
      wishlistAmount: formatFixed2(wishlist),
      spendableAmount: formatFixed2(spendable),
      dailySpendableEstimate: formatFixed2(daily),
    };
  });
}

export function computeAllocationMonthlyAmount(
  item: Pick<SalaryAllocationDTO, "mode" | "value">,
  monthlySalaryDec: Decimal
): Decimal {
  const valDec = toDecimal(item.value);
  if (item.mode === "percent") {
    return monthlySalaryDec
      .times(valDec)
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  return valDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function buildSalaryPlanSummary(params: {
  settings: SalarySettingsDTO | null;
  allocations: SalaryAllocationDTO[];
  wallets: WalletDTO[];
  transactions: TransactionDTO[];
  selectedYear: number;
  selectedMonth: number;
  now?: Date;
}): SalaryPlanSummary {
  const {
    settings,
    allocations,
    wallets,
    transactions,
    selectedYear,
    selectedMonth,
    now = new Date(),
  } = params;

  const monthlySalaryDec = toDecimal(settings?.monthlySalary ?? "0.00");
  const extraIncomeDec = toDecimal(settings?.extraIncome ?? "0.00");
  const totalPlannedIncomeDec = monthlySalaryDec.plus(extraIncomeDec);
  const hasSalaryConfigured = totalPlannedIncomeDec.gt(0);
  const payday = settings?.payday ?? 1;
  const salaryWalletId = settings?.salaryWalletId ?? null;

  const walletMap = new Map(wallets.map((w) => [w.id, w]));
  const salaryWallet = salaryWalletId ? walletMap.get(salaryWalletId) : undefined;

  const {
    startDate,
    endDate,
    totalDays: daysInMonth,
  } = getPaydayCycleDateRange(selectedYear, selectedMonth, payday);

  const todayIso = getBangkokToday(now);

  let daysRemaining = 0;
  if (todayIso < startDate) {
    daysRemaining = daysInMonth;
  } else if (todayIso > endDate) {
    daysRemaining = 0;
  } else {
    const diffDays = Math.round(
      (parseIsoToUtcMs(endDate) - parseIsoToUtcMs(todayIso)) / 86_400_000
    );
    daysRemaining = Math.max(1, diffDays + 1);
  }

  let periodIncomeDec = new Decimal(0);
  let periodExpenseDec = new Decimal(0);
  let todayIncomeDec = new Decimal(0);
  let todayExpenseDec = new Decimal(0);
  const transfersInByWallet = new Map<string, Decimal>();

  for (const tx of transactions) {
    const amountDec = toDecimal(tx.amount);

    if (tx.transactionDate === todayIso) {
      if (tx.type === "income") {
        todayIncomeDec = todayIncomeDec.plus(amountDec);
      } else if (tx.type === "expense") {
        todayExpenseDec = todayExpenseDec.plus(amountDec);
      }
    }

    if (tx.transactionDate < startDate || tx.transactionDate > endDate) {
      continue;
    }

    if (tx.type === "income") {
      periodIncomeDec = periodIncomeDec.plus(amountDec);
    } else if (tx.type === "expense") {
      periodExpenseDec = periodExpenseDec.plus(amountDec);
    } else if (tx.type === "transfer" && tx.toWalletId) {
      transfersInByWallet.set(
        tx.toWalletId,
        (transfersInByWallet.get(tx.toWalletId) ?? new Decimal(0)).plus(
          amountDec
        )
      );
    }
  }

  const remainingTransferPool = new Map<string, Decimal>(
    Array.from(transfersInByWallet.entries()).map(([k, v]) => [
      k,
      new Decimal(v),
    ])
  );

  const orderedAllocations = [...allocations].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  let totalAllocatedDec = new Decimal(0);
  let pendingTransferTotalDec = new Decimal(0);
  let pendingTransferCount = 0;

  const bucketSums: Record<PlanBucketType, Decimal> = {
    cold_money: new Decimal(0),
    dca: new Decimal(0),
    wishlist: new Decimal(0),
    other: new Decimal(0),
  };

  const computedAllocations: ComputedAllocationItem[] = orderedAllocations.map(
    (item) => {
      const monthlyAmountDec = computeAllocationMonthlyAmount(
        item,
        totalPlannedIncomeDec
      );
      const percentOfSalary = totalPlannedIncomeDec.gt(0)
        ? monthlyAmountDec
            .div(totalPlannedIncomeDec)
            .times(100)
            .toDecimalPlaces(1)
            .toNumber()
        : 0;

      const linkedWallet = item.linkedWalletId
        ? walletMap.get(item.linkedWalletId)
        : undefined;

      let transferredThisMonthDec = new Decimal(0);
      let pendingTransferDec = new Decimal(0);

      if (item.isActive) {
        totalAllocatedDec = totalAllocatedDec.plus(monthlyAmountDec);
        bucketSums[item.bucketType] =
          bucketSums[item.bucketType].plus(monthlyAmountDec);

        if (item.linkedWalletId && linkedWallet) {
          const pool =
            remainingTransferPool.get(item.linkedWalletId) ?? new Decimal(0);
          const applied = Decimal.min(pool, monthlyAmountDec);
          transferredThisMonthDec = applied;
          remainingTransferPool.set(item.linkedWalletId, pool.minus(applied));

          const remainingNeed = Decimal.max(
            0,
            monthlyAmountDec.minus(applied)
          );
          pendingTransferDec = remainingNeed;

          if (
            remainingNeed.gt(0) &&
            item.linkedWalletId !== salaryWalletId &&
            !linkedWallet.isArchived
          ) {
            pendingTransferTotalDec =
              pendingTransferTotalDec.plus(remainingNeed);
            pendingTransferCount += 1;
          }
        }
      }

      const isCompletedThisMonth =
        item.isActive &&
        item.linkedWalletId !== null &&
        monthlyAmountDec.gt(0) &&
        transferredThisMonthDec.gte(monthlyAmountDec);

      return {
        ...item,
        monthlyAmount: formatFixed2(monthlyAmountDec),
        percentOfSalary,
        linkedWalletName: linkedWallet?.name ?? null,
        linkedWalletBalance: linkedWallet?.currentBalance ?? null,
        transferredThisMonth: formatFixed2(transferredThisMonthDec),
        pendingTransfer: formatFixed2(pendingTransferDec),
        isCompletedThisMonth,
      };
    }
  );

  const spendableBudgetDec = totalPlannedIncomeDec.minus(totalAllocatedDec);
  const remainingToSpendDec = spendableBudgetDec.minus(periodExpenseDec);
  const allocationRatioPct = totalPlannedIncomeDec.gt(0)
    ? totalAllocatedDec
        .div(totalPlannedIncomeDec)
        .times(100)
        .toDecimalPlaces(1)
        .toNumber()
    : 0;
  const isOverAllocated =
    totalPlannedIncomeDec.gt(0) && totalAllocatedDec.gt(totalPlannedIncomeDec);

  let dailyAllowanceDec = new Decimal(0);
  let todayBudgetDec = new Decimal(0);
  let todayRemainingDec = new Decimal(0);

  if (daysRemaining > 0) {
    dailyAllowanceDec = remainingToSpendDec.gt(0)
      ? remainingToSpendDec
          .div(daysRemaining)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    const remainingBeforeTodayDec = remainingToSpendDec.plus(todayExpenseDec);
    todayBudgetDec = remainingBeforeTodayDec.gt(0)
      ? remainingBeforeTodayDec
          .div(daysRemaining)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    todayRemainingDec = todayBudgetDec.minus(todayExpenseDec);
  }

  return {
    hasSalaryConfigured,
    monthlySalary: formatFixed2(monthlySalaryDec),
    extraIncome: formatFixed2(extraIncomeDec),
    totalPlannedIncome: formatFixed2(totalPlannedIncomeDec),
    payday,
    salaryWalletId,
    salaryWalletName: salaryWallet?.name ?? null,
    selectedYear,
    selectedMonth,
    cycleStartDate: startDate,
    cycleEndDate: endDate,
    totalAllocated: formatFixed2(totalAllocatedDec),
    allocationRatioPct,
    isOverAllocated,
    spendableBudget: formatFixed2(spendableBudgetDec),
    periodIncome: formatFixed2(periodIncomeDec),
    periodExpense: formatFixed2(periodExpenseDec),
    remainingToSpend: formatFixed2(remainingToSpendDec),
    todayDate: todayIso,
    todayExpense: formatFixed2(todayExpenseDec),
    todayIncome: formatFixed2(todayIncomeDec),
    todayBudget: formatFixed2(todayBudgetDec),
    todayRemaining: formatFixed2(todayRemainingDec),
    daysInMonth,
    daysRemaining,
    dailyAllowance: formatFixed2(dailyAllowanceDec),
    bucketTotals: {
      cold_money: formatFixed2(bucketSums.cold_money),
      dca: formatFixed2(bucketSums.dca),
      wishlist: formatFixed2(bucketSums.wishlist),
      other: formatFixed2(bucketSums.other),
    },
    allocations: computedAllocations,
    pendingTransferTotal: formatFixed2(pendingTransferTotalDec),
    pendingTransferCount,
  };
}
