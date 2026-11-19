"use client";

import Decimal from "decimal.js";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PiggyBank,
  Plus,
  Target,
  Wallet,
} from "lucide-react";
import type { TransactionFormInput } from "@/actions/transactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIsoDateForDisplay } from "@/lib/date";
import { formatMoneyDisplay, sumMoney, toDecimal } from "@/lib/decimal";
import { PLAN_BUCKET_META } from "@/lib/salary-plan";
import type {
  ActionResult,
  CategoryDTO,
  ComputedAllocationItem,
  DashboardAnalytics,
  SalaryPlanSummary,
  TransactionDTO,
  WalletDTO,
  WalletType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { StreakFlameWidget } from "./streak-flame-widget";
import { TransactionFormDialog } from "./transaction-form-dialog";

const MonthlyTrendChart = dynamic(
  () => import("./charts").then((m) => m.MonthlyTrendChart),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
  }
);

const ExpenseDonutChart = dynamic(
  () => import("./charts").then((m) => m.ExpenseDonutChart),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
  }
);

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const RECENT_TRANSACTIONS_PAGE_SIZE = 10;

const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  cash: "เงินสด",
  bank: "ธนาคาร",
  credit_card: "บัตรเครดิต",
  ewallet: "E-Wallet",
  savings_goal: "กระเป๋าเป้าหมาย",
  investment: "พอร์ตหุ้น / ลงทุน",
};

interface DashboardViewProps {
  userName?: string | null;
  analytics: DashboardAnalytics;
  salaryPlan?: SalaryPlanSummary;
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  onChangeMonth: (year: number, month: number) => void;
  onSaveTransaction: (
    values: TransactionFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
  onViewAllTransactions: () => void;
  onOpenPlan?: () => void;
  onOpenManage?: () => void;
}

export function DashboardView({
  userName,
  analytics,
  salaryPlan,
  wallets,
  categories,
  onChangeMonth,
  onSaveTransaction,
  onViewAllTransactions,
  onOpenPlan,
  onOpenManage,
}: DashboardViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null);
  const selectedMonthKey = `${analytics.selectedYear}-${analytics.selectedMonth}`;
  const [recentPageState, setRecentPageState] = useState<{
    monthKey: string;
    page: number;
  }>({ monthKey: selectedMonthKey, page: 1 });

  const totalRecentCount = analytics.recentTransactions.length;
  const recentTotalPages = Math.max(
    1,
    Math.ceil(totalRecentCount / RECENT_TRANSACTIONS_PAGE_SIZE)
  );
  const rawRecentPage =
    recentPageState.monthKey === selectedMonthKey ? recentPageState.page : 1;
  const recentCurrentPage = Math.min(rawRecentPage, recentTotalPages);
  const recentStartIndex =
    (recentCurrentPage - 1) * RECENT_TRANSACTIONS_PAGE_SIZE;
  const paginatedRecentTransactions = analytics.recentTransactions.slice(
    recentStartIndex,
    recentStartIndex + RECENT_TRANSACTIONS_PAGE_SIZE
  );

  const activeWallets = wallets.filter((w) => !w.isArchived);

  const linkedAllocationsByWalletId = new Map<string, ComputedAllocationItem[]>();
  for (const alloc of salaryPlan?.allocations ?? []) {
    if (!alloc.isActive || !alloc.linkedWalletId) continue;
    const list = linkedAllocationsByWalletId.get(alloc.linkedWalletId) ?? [];
    list.push(alloc);
    linkedAllocationsByWalletId.set(alloc.linkedWalletId, list);
  }

  const goalWallets = activeWallets.filter(
    (w) =>
      w.type !== "credit_card" &&
      (w.type === "savings_goal" ||
        w.type === "investment" ||
        (linkedAllocationsByWalletId.has(w.id) &&
          w.id !== salaryPlan?.salaryWalletId))
  );
  const goalWalletIdSet = new Set(goalWallets.map((w) => w.id));
  const spendingWallets = activeWallets.filter(
    (w) => w.type !== "credit_card" && !goalWalletIdSet.has(w.id)
  );
  const creditWallets = activeWallets.filter((w) => w.type === "credit_card");

  const spendingTotal = sumMoney(spendingWallets.map((w) => w.currentBalance));
  const goalWalletsTotal = sumMoney(goalWallets.map((w) => w.currentBalance));

  const monthLabel = `${THAI_MONTHS[analytics.selectedMonth - 1]} ${analytics.selectedYear + 543}`;
  const periodNetDecimal = toDecimal(analytics.periodNet);

  function goPrevMonth() {
    if (analytics.selectedMonth === 1) {
      onChangeMonth(analytics.selectedYear - 1, 12);
    } else {
      onChangeMonth(analytics.selectedYear, analytics.selectedMonth - 1);
    }
  }

  function goNextMonth() {
    if (analytics.selectedMonth === 12) {
      onChangeMonth(analytics.selectedYear + 1, 1);
    } else {
      onChangeMonth(analytics.selectedYear, analytics.selectedMonth + 1);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + Month Switcher + Quick Add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {userName ? `สวัสดี, ${userName}` : "ภาพรวมการเงิน"}
          </h1>
          <p className="text-sm text-muted-foreground">
            สรุปกระแสเงินสดและยอดคงเหลือในกระเป๋า (Asia/Bangkok)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="max-lg:size-9"
              onClick={goPrevMonth}
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-28 px-2 text-center text-sm font-medium">
              {monthLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="max-lg:size-9"
              onClick={goNextMonth}
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setFormOpen(true);
            }}
            className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            <span>จดรายการด่วน</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
              <Wallet className="h-4 w-4 text-teal-600" />
              เงินในกระเป๋าใช้จ่ายทั่วไป
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              ฿{formatMoneyDisplay(spendingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            ไม่รวมกระเป๋าเป้าหมายและบัตรเครดิต
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
              <CreditCard className="h-4 w-4 text-amber-600" />
              ยอดค้างชำระบัตรเครดิต
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600 tabular-nums">
              ฿{formatMoneyDisplay(analytics.creditCardDebtTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            แยกออกจากเงินสดและเงินฝาก
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              รายรับ ({monthLabel})
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600 tabular-nums">
              +฿{formatMoneyDisplay(analytics.periodIncome)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            ไม่รวมรายการโอนย้ายระหว่างบัญชี
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
              <ArrowUpRight className="h-4 w-4 text-rose-600" />
              รายจ่าย ({monthLabel})
            </CardDescription>
            <CardTitle className="text-2xl text-rose-600 tabular-nums">
              -฿{formatMoneyDisplay(analytics.periodExpense)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            กระแสเงินสดสุทธิเดือนนี้:{" "}
            <span
              className={cn(
                "whitespace-nowrap font-semibold tabular-nums",
                periodNetDecimal.gte(0) ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {periodNetDecimal.gte(0) ? "+" : "-"}฿
              {formatMoneyDisplay(periodNetDecimal.abs())}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Per-Wallet Real Balances (Spending vs Goal/Investment) */}
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-teal-600" />
              <span>ยอดเงินจริงในแต่ละกระเป๋า</span>
            </CardTitle>
            <CardDescription>
              แยกให้เห็นชัดระหว่างเงินใช้จ่ายทั่วไป กับกระเป๋าเก็บตามเป้าหมาย / หุ้น
            </CardDescription>
          </div>
          {onOpenManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenManage}
              className="shrink-0"
            >
              จัดการกระเป๋า &amp; ปรับยอด
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {activeWallets.length === 0 ? (
            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              ยังไม่มีกระเป๋าเงินที่เปิดใช้งาน
            </p>
          ) : (
            <>
              {/* Section 1: Spending Wallets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    💳 กระเป๋าใช้จ่ายทั่วไป
                  </span>
                  <span className="font-semibold text-teal-700 tabular-nums dark:text-teal-300">
                    รวม ฿{formatMoneyDisplay(spendingTotal)}
                  </span>
                </div>
                {spendingWallets.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                    ยังไม่มีกระเป๋าใช้จ่ายทั่วไป
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {spendingWallets.map((wallet) => {
                      const bal = toDecimal(wallet.currentBalance);
                      return (
                        <div
                          key={wallet.id}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: wallet.color ?? "#0f766e",
                                }}
                              />
                              <p className="truncate font-medium">{wallet.name}</p>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {WALLET_TYPE_LABEL[wallet.type]}
                            </p>
                          </div>

                          <p
                            className={cn(
                              "shrink-0 font-semibold tabular-nums",
                              bal.isNegative() ? "text-rose-600" : "text-foreground"
                            )}
                          >
                            ฿{formatMoneyDisplay(bal)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Goal / Investment Wallets */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    🎯 กระเป๋าเก็บตามเป้าหมาย &amp; พอร์ตลงทุน
                  </span>
                  <span className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                    รวม ฿{formatMoneyDisplay(goalWalletsTotal)}
                  </span>
                </div>

                {goalWallets.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    <span>
                      ยังไม่มีกระเป๋าแยกสำหรับเก็บเป้าหมาย (เช่น พอร์ตหุ้น, ซื้อของให้แฟน, ของที่อยากได้)
                    </span>
                    {onOpenManage ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onOpenManage}
                        className="h-7 text-xs"
                      >
                        สร้างกระเป๋าแยกเลย
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {goalWallets.map((wallet) => {
                      const bal = toDecimal(wallet.currentBalance);
                      const linkedAllocs =
                        linkedAllocationsByWalletId.get(wallet.id) ?? [];
                      const linkedNames = linkedAllocs.map((a) => a.name);

                      let progressPct: number | null = null;
                      let progressLabel: string | null = null;

                      if (linkedAllocs.length > 0) {
                        const targetTotals = linkedAllocs
                          .map((a) => a.targetTotal)
                          .filter((t): t is string =>
                            Boolean(t && toDecimal(t).gt(0))
                          );

                        if (targetTotals.length > 0) {
                          const totalTargetDec = sumMoney(targetTotals);
                          const pct = Math.min(
                            100,
                            Math.max(
                              0,
                              bal.div(totalTargetDec).times(100).toNumber()
                            )
                          );
                          const remainingDec = Decimal.max(
                            0,
                            totalTargetDec.minus(bal)
                          );
                          progressPct = pct;
                          progressLabel = bal.gte(totalTargetDec)
                            ? "🎉 เก็บครบเป้าหมายแล้ว!"
                            : `อีก ฿${formatMoneyDisplay(remainingDec)} ถึงเป้า ฿${formatMoneyDisplay(totalTargetDec)}`;
                        } else {
                          const monthlyTargetDec = sumMoney(
                            linkedAllocs.map((a) => a.monthlyAmount)
                          );
                          if (monthlyTargetDec.gt(0)) {
                            const transferredDec = sumMoney(
                              linkedAllocs.map((a) => a.transferredThisMonth)
                            );
                            const progressBase = transferredDec.gt(0)
                              ? transferredDec
                              : Decimal.min(
                                  Decimal.max(0, bal),
                                  monthlyTargetDec
                                );
                            const pct = Math.min(
                              100,
                              Math.max(
                                0,
                                progressBase
                                  .div(monthlyTargetDec)
                                  .times(100)
                                  .toNumber()
                              )
                            );
                            progressPct = pct;
                            progressLabel = progressBase.gte(monthlyTargetDec)
                              ? `ครบเป้าเดือนนี้แล้ว (฿${formatMoneyDisplay(monthlyTargetDec)}/เดือน)`
                              : `เป้าเดือนนี้ ฿${formatMoneyDisplay(progressBase)} / ฿${formatMoneyDisplay(monthlyTargetDec)}`;
                          }
                        }
                      }

                      return (
                        <div
                          key={wallet.id}
                          className="flex flex-col justify-between gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-3.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: wallet.color ?? "#10b981",
                                  }}
                                />
                                <p className="truncate font-medium">
                                  {wallet.name}
                                </p>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {linkedNames.length > 0
                                  ? `เป้าหมาย: ${linkedNames.join(", ")}`
                                  : WALLET_TYPE_LABEL[wallet.type]}
                              </p>
                            </div>

                            <p className="shrink-0 font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                              ฿{formatMoneyDisplay(bal)}
                            </p>
                          </div>

                          {progressPct !== null && progressLabel ? (
                            <div className="space-y-1">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-950/10 dark:bg-emerald-100/10">
                                <div
                                  className="animate-mf-progress h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                  style={{
                                    width: `${progressPct}%`,
                                    backgroundColor: wallet.color ?? "#10b981",
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                                <span className="truncate text-muted-foreground">
                                  {progressLabel}
                                </span>
                                <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-300">
                                  {progressPct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 3: Credit Cards (only when active credit cards exist) */}
              {creditWallets.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      💳 บัตรเครดิต
                    </span>
                    <span className="font-semibold text-amber-600 tabular-nums">
                      ยอดค้างชำระ ฿{formatMoneyDisplay(analytics.creditCardDebtTotal)}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {creditWallets.map((wallet) => {
                      const bal = toDecimal(wallet.currentBalance);
                      return (
                        <div
                          key={wallet.id}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: wallet.color ?? "#f59e0b",
                                }}
                              />
                              <p className="truncate font-medium">{wallet.name}</p>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {WALLET_TYPE_LABEL[wallet.type]}
                              {bal.isNegative() ? " (ยอดค้างชำระ)" : ""}
                            </p>
                          </div>

                          <p
                            className={cn(
                              "shrink-0 font-semibold tabular-nums",
                              bal.isNegative() ? "text-amber-600" : "text-foreground"
                            )}
                          >
                            {bal.isNegative()
                              ? `฿${formatMoneyDisplay(bal.abs())}`
                              : `฿${formatMoneyDisplay(bal)}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Salary Plan & Daily Spending Summary */}
      {salaryPlan ? (
        <Card className="border-teal-600/25 bg-card">
          <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PiggyBank className="h-4 w-4 text-teal-600" />
                <span>แผนเงินเดือน & ยอดใช้จ่ายวันนี้</span>
              </CardTitle>
              <CardDescription>
                {salaryPlan.hasSalaryConfigured
                  ? toDecimal(salaryPlan.extraIncome).gt(0)
                    ? `รายได้ในแผน ฿${formatMoneyDisplay(salaryPlan.totalPlannedIncome)} (เงินเดือน ฿${formatMoneyDisplay(salaryPlan.monthlySalary)} + เสริม ฿${formatMoneyDisplay(salaryPlan.extraIncome)}) • หักเก็บออม ฿${formatMoneyDisplay(salaryPlan.totalAllocated)}`
                    : `เงินเดือน ฿${formatMoneyDisplay(salaryPlan.monthlySalary)} (ออกวันที่ ${salaryPlan.payday}) • หักเก็บออม ฿${formatMoneyDisplay(salaryPlan.totalAllocated)}`
                  : "ตั้งเงินเดือนคงที่หรือรายได้เสริมเพื่อแบ่งก้อนเงินเย็น DCA ของที่อยากได้ และคำนวณงบต่อวัน"}
              </CardDescription>
            </div>
            {onOpenPlan ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPlan}
                className="shrink-0"
              >
                {salaryPlan.hasSalaryConfigured ? "จัดการแผนเงินเดือน" : "ตั้งแผนเงินเดือน"}
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-3">
            {salaryPlan.hasSalaryConfigured ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-xs text-muted-foreground">
                      คงเหลือใช้จ่ายได้จริง ({monthLabel})
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-lg font-bold tabular-nums",
                        toDecimal(salaryPlan.remainingToSpend).gte(0)
                          ? "text-emerald-600"
                          : "text-rose-600"
                      )}
                    >
                      {toDecimal(salaryPlan.remainingToSpend).gte(0) ? "" : "-"}฿
                      {formatMoneyDisplay(
                        toDecimal(salaryPlan.remainingToSpend).abs()
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                      จากงบใช้จ่าย ฿{formatMoneyDisplay(salaryPlan.spendableBudget)}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-background p-3">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
                      <span>
                        วันนี้ใช้ไปแล้ว ({formatIsoDateForDisplay(salaryPlan.todayDate)})
                      </span>
                    </p>
                    <p className="mt-1 text-lg font-bold text-rose-600 tabular-nums">
                      -฿{formatMoneyDisplay(salaryPlan.todayExpense)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                      {salaryPlan.daysRemaining > 0
                        ? `เป้างบวันนี้ ฿${formatMoneyDisplay(salaryPlan.todayBudget)}`
                        : "สรุปยอดรายวัน"}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-background p-3 sm:col-span-2 lg:col-span-1">
                    <p className="text-xs text-muted-foreground">
                      เฉลี่ยใช้ได้วันละ
                    </p>
                    <p className="mt-1 text-lg font-bold text-teal-700 tabular-nums dark:text-teal-300">
                      ฿{formatMoneyDisplay(salaryPlan.dailyAllowance)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / วัน
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                      {salaryPlan.daysRemaining > 0
                        ? `เหลืออีก ${salaryPlan.daysRemaining} วันในเดือนนี้`
                        : "เดือนนี้สิ้นสุดแล้ว"}
                    </p>
                  </div>
                </div>

                {salaryPlan.allocations.some((a) => a.isActive) ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {salaryPlan.allocations
                      .filter((a) => a.isActive)
                      .map((item) => {
                        const meta = PLAN_BUCKET_META[item.bucketType];
                        return (
                          <div
                            key={item.id}
                            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs tabular-nums"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="font-medium">{item.name}:</span>
                            <span>฿{formatMoneyDisplay(item.monthlyAmount)}</span>
                            {item.isCompletedThisMonth ? (
                              <span className="text-emerald-600 font-semibold">✓</span>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                <span>
                  วันนี้ใช้จ่ายไปแล้ว{" "}
                  <strong className="text-rose-600 tabular-nums">
                    -฿{formatMoneyDisplay(salaryPlan.todayExpense)}
                  </strong>{" "}
                  (รายรับวันนี้ +฿{formatMoneyDisplay(salaryPlan.todayIncome)})
                </span>
                {onOpenPlan ? (
                  <button
                    type="button"
                    onClick={onOpenPlan}
                    className="font-medium text-teal-700 underline underline-offset-4 dark:text-teal-300"
                  >
                    เริ่มตั้งเงินเดือน & เป้าหมายออม →
                  </button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">
              เปรียบเทียบรายรับ - รายจ่าย (6 เดือนล่าสุด)
            </CardTitle>
            <CardDescription>
              ไม่นับรวมรายการโอนย้ายระหว่างกระเป๋าเงิน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyTrendChart data={analytics.monthlyTrend} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">สัดส่วนรายจ่ายตามหมวดหมู่</CardTitle>
            <CardDescription>{monthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpenseDonutChart
              data={analytics.expenseByCategory}
              totalExpense={analytics.periodExpense}
            />
          </CardContent>
        </Card>
      </div>

      {/* Monthly Budgets Progress */}
      {analytics.budgetStatuses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-teal-600" />
              <span>งบประมาณรายเดือน ({monthLabel})</span>
            </CardTitle>
            <CardDescription>
              ติดตามการใช้จ่ายเทียบกับเพดานงบที่ตั้งไว้ในแต่ละหมวดหมู่
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {analytics.budgetStatuses.map((b) => {
                const barWidth = Math.min(100, Math.max(0, b.percentage));
                const remainingDec = toDecimal(b.remaining);
                return (
                  <div
                    key={b.categoryId}
                    className="space-y-2 rounded-xl border bg-background p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="truncate text-sm font-medium">
                          {b.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
                          b.isOverBudget
                            ? "text-rose-600"
                            : b.isNearLimit
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        )}
                      >
                        {b.isOverBudget || b.isNearLimit ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : null}
                        {b.percentage.toFixed(0)}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          b.isOverBudget
                            ? "bg-rose-600"
                            : b.isNearLimit
                              ? "bg-amber-500"
                              : "bg-teal-600"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                      <span>
                        ใช้ไป ฿{formatMoneyDisplay(b.spent)} / ฿
                        {formatMoneyDisplay(b.budget)}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          b.isOverBudget ? "text-rose-600" : "text-emerald-600"
                        )}
                      >
                        {b.isOverBudget
                          ? `เกินงบ ฿${formatMoneyDisplay(remainingDec.abs())}`
                          : `คงเหลือ ฿${formatMoneyDisplay(remainingDec)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              รายการเคลื่อนไหวล่าสุด ({monthLabel})
            </CardTitle>
            <CardDescription>
              คลิกที่รายการเพื่อแก้ไข หรือดูรายการทั้งหมดพร้อมตัวกรองและ Export Excel
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewAllTransactions}
            className="shrink-0"
          >
            ดูทั้งหมด
          </Button>
        </CardHeader>
        <CardContent>
          {totalRecentCount === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการในเดือนนี้ กดปุ่ม &ldquo;+ จดรายการด่วน&rdquo; เพื่อเริ่มบันทึก
            </div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y">
                {paginatedRecentTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => {
                      setEditingTx(tx);
                      setFormOpen(true);
                    }}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-2 sm:rounded-lg"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          tx.type === "income"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : tx.type === "expense"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-sky-500/10 text-sky-600"
                        )}
                      >
                        {tx.type === "income" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : tx.type === "expense" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowLeftRight className="h-4 w-4" />
                        )}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium">
                            {tx.type === "transfer"
                              ? `${tx.walletName} → ${tx.toWalletName ?? "-"}`
                              : (tx.categoryName ?? "ไม่ระบุหมวดหมู่")}
                          </p>
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {tx.walletName}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatIsoDateForDisplay(tx.transactionDate)}
                          {tx.note ? ` • ${tx.note}` : ""}
                        </p>
                      </div>
                    </div>

                    <p
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        tx.type === "income"
                          ? "text-emerald-600"
                          : tx.type === "expense"
                            ? "text-rose-600"
                            : "text-sky-600"
                      )}
                    >
                      {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                      ฿{formatMoneyDisplay(tx.amount)}
                    </p>
                  </button>
                ))}
              </div>

              {totalRecentCount > RECENT_TRANSACTIONS_PAGE_SIZE ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    แสดง {recentStartIndex + 1}–
                    {Math.min(
                      recentStartIndex + RECENT_TRANSACTIONS_PAGE_SIZE,
                      totalRecentCount
                    )}{" "}
                    จากทั้งหมด <strong>{totalRecentCount}</strong> รายการ
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="max-lg:size-9"
                      disabled={recentCurrentPage <= 1}
                      onClick={() =>
                        setRecentPageState({
                          monthKey: selectedMonthKey,
                          page: Math.max(1, recentCurrentPage - 1),
                        })
                      }
                      aria-label="หน้าก่อนหน้า"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-medium tabular-nums">
                      หน้า {recentCurrentPage} / {recentTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="max-lg:size-9"
                      disabled={recentCurrentPage >= recentTotalPages}
                      onClick={() =>
                        setRecentPageState({
                          monthKey: selectedMonthKey,
                          page: Math.min(recentTotalPages, recentCurrentPage + 1),
                        })
                      }
                      aria-label="หน้าถัดไป"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        wallets={wallets}
        categories={categories}
        initialTransaction={editingTx}
        onSubmit={onSaveTransaction}
      />

      <StreakFlameWidget
        streak={analytics.streak}
        onQuickRecord={() => {
          setEditingTx(null);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
