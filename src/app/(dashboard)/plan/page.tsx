import type { Metadata } from "next";
import { Suspense } from "react";
import { DatabaseConnectionWarning } from "@/components/finance/db-connection-warning";
import { DbPlanClient } from "@/components/finance/db-plan-client";
import { getUserPlanPageData } from "@/lib/finance-queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "แผนเงินเดือน & เป้าหมายออม",
};

async function PlanContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const rawYear = typeof sp.year === "string" ? Number(sp.year) : undefined;
  const rawMonth = typeof sp.month === "string" ? Number(sp.month) : undefined;

  const targetYear =
    rawYear && Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100
      ? rawYear
      : undefined;
  const targetMonth =
    rawMonth && Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth
      : undefined;

  let data: Awaited<ReturnType<typeof getUserPlanPageData>> | null = null;
  try {
    data = await getUserPlanPageData(user.id, targetYear, targetMonth);
  } catch (error) {
    console.error("Plan page database query error:", error);
  }

  if (!data) {
    return <DatabaseConnectionWarning />;
  }

  return <DbPlanClient summary={data.summary} wallets={data.wallets} />;
}

export default function PlanPage(props: PageProps<"/plan">) {
  return (
    <Suspense
      fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}
    >
      <PlanContent searchParams={props.searchParams} />
    </Suspense>
  );
}
