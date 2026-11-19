"use client";

import { useRouter } from "next/navigation";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionFormInput,
} from "@/actions/transactions";
import type {
  ActionResult,
  CategoryDTO,
  DashboardAnalytics,
  SalaryPlanSummary,
  WalletDTO,
} from "@/lib/types";
import { DashboardView } from "./dashboard-view";

export function DbDashboardClient({
  userName,
  analytics,
  salaryPlan,
  wallets,
  categories,
}: {
  userName?: string | null;
  analytics: DashboardAnalytics;
  salaryPlan: SalaryPlanSummary;
  wallets: WalletDTO[];
  categories: CategoryDTO[];
}) {
  const router = useRouter();

  function handleChangeMonth(year: number, month: number) {
    router.push(`/?year=${year}&month=${month}`);
  }

  async function handleSaveTransaction(
    values: TransactionFormInput,
    editingId?: string
  ): Promise<ActionResult<unknown>> {
    const res = editingId
      ? await updateTransactionAction(editingId, values)
      : await createTransactionAction(values);

    if (res.ok) {
      router.refresh();
    }
    return res;
  }

  return (
    <DashboardView
      userName={userName}
      analytics={analytics}
      salaryPlan={salaryPlan}
      wallets={wallets}
      categories={categories}
      onChangeMonth={handleChangeMonth}
      onSaveTransaction={handleSaveTransaction}
      onViewAllTransactions={() => router.push("/transactions")}
      onOpenPlan={() => router.push("/plan")}
      onOpenManage={() => router.push("/manage")}
    />
  );
}
