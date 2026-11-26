"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { TransactionFormInput } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sumMoney } from "@/lib/decimal";
import type {
  ActionResult,
  CategoryDTO,
  ComputedAllocationItem,
  DashboardAnalytics,
  SalaryPlanSummary,
  TransactionDTO,
  WalletDTO,
} from "@/lib/types";
import { DashboardBudgetsRecent } from "./dashboard/dashboard-budgets-recent";
import { DashboardKpiCards } from "./dashboard/dashboard-kpi-cards";
import { DashboardWalletsCard } from "./dashboard/dashboard-wallets-card";
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
  onOpenManage,
}: DashboardViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null);

  const activeWallets = wallets.filter((w) => !w.isArchived);

  const linkedAllocationsByWalletId = new Map<
    string,
    ComputedAllocationItem[]
  >();
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
      <DashboardKpiCards
        spendingTotal={spendingTotal}
        creditCardDebtTotal={analytics.creditCardDebtTotal}
        periodIncome={analytics.periodIncome}
        periodExpense={analytics.periodExpense}
        periodNet={analytics.periodNet}
        monthLabel={monthLabel}
      />

      {/* Per-Wallet Real Balances (Spending vs Goal/Investment) */}
      <DashboardWalletsCard
        activeWallets={activeWallets}
        spendingWallets={spendingWallets}
        goalWallets={goalWallets}
        creditWallets={creditWallets}
        spendingTotal={spendingTotal}
        goalWalletsTotal={goalWalletsTotal}
        creditCardDebtTotal={analytics.creditCardDebtTotal}
        linkedAllocationsByWalletId={linkedAllocationsByWalletId}
        onOpenManage={onOpenManage}
      />

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
            <CardTitle className="text-base">
              สัดส่วนรายจ่ายตามหมวดหมู่
            </CardTitle>
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

      {/* Monthly Budgets Progress & Recent Transactions */}
      <DashboardBudgetsRecent
        budgetStatuses={analytics.budgetStatuses}
        recentTransactions={analytics.recentTransactions}
        monthLabel={monthLabel}
        onEditTransaction={(tx) => {
          setEditingTx(tx);
          setFormOpen(true);
        }}
        onViewAllTransactions={onViewAllTransactions}
      />

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
