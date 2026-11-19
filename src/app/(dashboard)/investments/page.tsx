import type { Metadata } from "next";
import { Suspense } from "react";
import { InvestmentsView } from "@/components/finance/investments-view";
import { getBangkokYearMonth } from "@/lib/date";
import { formatFixed2, sumMoney } from "@/lib/decimal";
import { getUserPlanPageData } from "@/lib/finance-queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "การลงทุน & แผน DCA",
};

async function InvestmentsContent() {
  const user = await requireUser();
  const { year, month } = getBangkokYearMonth();
  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;

  let linkedInvestmentWalletTotal = "0.00";
  let linkedInvestmentWalletCount = 0;
  let linkedPlanDcaMonthly = "0.00";

  try {
    const planData = await getUserPlanPageData(user.id, year, month);
    const investmentWallets = planData.wallets.filter(
      (w) => !w.isArchived && w.type === "investment"
    );
    linkedInvestmentWalletCount = investmentWallets.length;
    linkedInvestmentWalletTotal = formatFixed2(
      sumMoney(investmentWallets.map((w) => w.currentBalance))
    );
    linkedPlanDcaMonthly = planData.summary.bucketTotals.dca;
  } catch (error) {
    console.error("Investments page context query error:", error);
  }

  return (
    <InvestmentsView
      storageKey={`moneyflow_investments_ui_${user.id}`}
      currentGregorianYear={year}
      currentMonthKey={currentMonthKey}
      linkedInvestmentWalletTotal={linkedInvestmentWalletTotal}
      linkedInvestmentWalletCount={linkedInvestmentWalletCount}
      linkedPlanDcaMonthly={linkedPlanDcaMonthly}
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
