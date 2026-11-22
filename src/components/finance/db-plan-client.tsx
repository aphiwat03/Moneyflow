"use client";

import { useRouter } from "next/navigation";
import {
  applyRecommendedSplitAction,
  createSalaryAllocationAction,
  deleteSalaryAllocationAction,
  executeMonthlyAllocationTransfersAction,
  saveSalarySettingsAction,
  updateSalaryAllocationAction,
  type SalaryAllocationFormInput,
  type SalarySettingsFormInput,
} from "@/actions/salary-plan";
import { useServerRefresh } from "@/lib/use-server-refresh";
import type { ActionResult, SalaryPlanSummary, WalletDTO } from "@/lib/types";
import { PlanView } from "./plan-view";

export function DbPlanClient({
  summary,
  wallets,
}: {
  summary: SalaryPlanSummary;
  wallets: WalletDTO[];
}) {
  const router = useRouter();
  const { refreshAsync } = useServerRefresh();

  function handleChangeMonth(year: number, month: number) {
    router.push(`/plan?year=${year}&month=${month}`);
  }

  async function handleSaveSettings(
    input: SalarySettingsFormInput
  ): Promise<ActionResult<unknown>> {
    const res = await saveSalarySettingsAction(input);
    if (res.ok) await refreshAsync();
    return res;
  }

  async function handleSaveAllocation(
    input: SalaryAllocationFormInput,
    editingId?: string
  ): Promise<ActionResult<unknown>> {
    const res = editingId
      ? await updateSalaryAllocationAction(editingId, input)
      : await createSalaryAllocationAction(input);
    if (res.ok) await refreshAsync();
    return res;
  }

  async function handleDeleteAllocation(
    allocationId: string
  ): Promise<ActionResult<unknown>> {
    const res = await deleteSalaryAllocationAction(allocationId);
    if (res.ok) await refreshAsync();
    return res;
  }

  async function handleApplyRecommendedSplit(params: {
    strategyId: "balanced" | "conservative" | "aggressive_invest";
    replaceExisting?: boolean;
  }): Promise<ActionResult<unknown>> {
    const res = await applyRecommendedSplitAction(params);
    if (res.ok) await refreshAsync();
    return res;
  }

  async function handleExecuteMonthlyTransfers(params: {
    year: number;
    month: number;
  }) {
    const res = await executeMonthlyAllocationTransfersAction(params);
    if (res.ok) await refreshAsync();
    return res;
  }

  return (
    <PlanView
      summary={summary}
      wallets={wallets}
      onChangeMonth={handleChangeMonth}
      onSaveSettings={handleSaveSettings}
      onSaveAllocation={handleSaveAllocation}
      onDeleteAllocation={handleDeleteAllocation}
      onApplyRecommendedSplit={handleApplyRecommendedSplit}
      onExecuteMonthlyTransfers={handleExecuteMonthlyTransfers}
    />
  );
}
