"use client";

import { useMemo } from "react";
import {
  deleteDcaLogAction,
  deleteInvestmentHoldingAction,
  deleteInvestmentSnapshotAction,
  importLocalInvestmentsAction,
  recordDcaExecutionAction,
  recordDividendAction,
  saveInvestmentSettingsAction,
  upsertInvestmentHoldingAction,
  upsertInvestmentSnapshotAction,
} from "@/actions/investments";
import {
  InvestmentsView,
  type InvestmentsViewDbHandlers,
} from "./investments-view";
import type {
  CategoryDTO,
  InvestmentDcaLogDTO,
  InvestmentHoldingDTO,
  InvestmentPlanSettingsDTO,
  InvestmentSnapshotDTO,
  WalletDTO,
} from "@/lib/types";

export function DbInvestmentsClient({
  storageKey,
  currentGregorianYear,
  currentMonthKey,
  todayIso,
  initialSettings,
  initialHoldings,
  initialSnapshots,
  initialDcaLogs,
  wallets,
  incomeCategories,
  linkedInvestmentWalletTotal,
  linkedInvestmentWalletCount,
  linkedPlanDcaMonthly,
}: {
  storageKey: string;
  currentGregorianYear: number;
  currentMonthKey: string;
  todayIso: string;
  initialSettings: InvestmentPlanSettingsDTO | null;
  initialHoldings: InvestmentHoldingDTO[];
  initialSnapshots: InvestmentSnapshotDTO[];
  initialDcaLogs: InvestmentDcaLogDTO[];
  wallets: WalletDTO[];
  incomeCategories: CategoryDTO[];
  linkedInvestmentWalletTotal: string;
  linkedInvestmentWalletCount: number;
  linkedPlanDcaMonthly: string;
}) {
  const dbHandlers = useMemo<InvestmentsViewDbHandlers>(
    () => ({
      onSaveSettings: saveInvestmentSettingsAction,
      onUpsertHolding: upsertInvestmentHoldingAction,
      onDeleteHolding: deleteInvestmentHoldingAction,
      onUpsertSnapshot: upsertInvestmentSnapshotAction,
      onDeleteSnapshot: deleteInvestmentSnapshotAction,
      onRecordDca: recordDcaExecutionAction,
      onDeleteDcaLog: deleteDcaLogAction,
      onRecordDividend: recordDividendAction,
      onImportLocalWorkspace: importLocalInvestmentsAction,
    }),
    []
  );

  return (
    <InvestmentsView
      storageKey={storageKey}
      persistenceMode="database"
      initialSettings={initialSettings}
      initialHoldings={initialHoldings}
      initialSnapshots={initialSnapshots}
      initialDcaLogs={initialDcaLogs}
      wallets={wallets}
      incomeCategories={incomeCategories}
      dbHandlers={dbHandlers}
      currentGregorianYear={currentGregorianYear}
      currentMonthKey={currentMonthKey}
      todayIso={todayIso}
      linkedInvestmentWalletTotal={linkedInvestmentWalletTotal}
      linkedInvestmentWalletCount={linkedInvestmentWalletCount}
      linkedPlanDcaMonthly={linkedPlanDcaMonthly}
    />
  );
}
