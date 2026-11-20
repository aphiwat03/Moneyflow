import type { Metadata } from "next";
import { Suspense } from "react";
import { DatabaseConnectionWarning } from "@/components/finance/db-connection-warning";
import { DbInvestmentsClient } from "@/components/finance/db-investments-client";
import { getBangkokToday, getBangkokYearMonth } from "@/lib/date";
import { getUserInvestmentPageData } from "@/lib/finance-queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "การลงทุน & แผน DCA",
};

async function InvestmentsContent() {
  const user = await requireUser();
  const { year, month } = getBangkokYearMonth();
  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  const todayIso = getBangkokToday();

  let data: Awaited<ReturnType<typeof getUserInvestmentPageData>> | null = null;
  try {
    data = await getUserInvestmentPageData(user.id);
  } catch (error) {
    console.error("Investments page database query error:", error);
  }

  if (!data) {
    return <DatabaseConnectionWarning />;
  }

  return (
    <DbInvestmentsClient
      storageKey={`moneyflow_investments_ui_${user.id}`}
      currentGregorianYear={year}
      currentMonthKey={currentMonthKey}
      todayIso={todayIso}
      initialSettings={data.settings}
      initialHoldings={data.holdings}
      initialSnapshots={data.snapshots}
      initialDcaLogs={data.dcaLogs}
      wallets={data.wallets}
      incomeCategories={data.incomeCategories}
      linkedInvestmentWalletTotal={data.linkedInvestmentWalletTotal}
      linkedInvestmentWalletCount={data.linkedInvestmentWalletCount}
      linkedPlanDcaMonthly={data.linkedPlanDcaMonthly}
    />
  );
}

export default function InvestmentsPage() {
  return (
    <Suspense
      fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}
    >
      <InvestmentsContent />
    </Suspense>
  );
}
