import { Suspense } from "react";
import { DatabaseConnectionWarning } from "@/components/finance/db-connection-warning";
import { DbDashboardClient } from "@/components/finance/db-dashboard-client";
import { getUserDashboardData } from "@/lib/finance-queries";
import { requireUser } from "@/lib/session";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function DashboardContent({
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

  let data: Awaited<ReturnType<typeof getUserDashboardData>> | null = null;
  try {
    data = await getUserDashboardData(user.id, targetYear, targetMonth);
  } catch (error) {
    console.error("Dashboard database query error:", error);
  }

  if (!data) {
    return <DatabaseConnectionWarning />;
  }

  return (
    <DbDashboardClient
      userName={user.name}
      analytics={data.analytics}
      salaryPlan={data.salaryPlan}
      wallets={data.wallets}
      categories={data.categories}
    />
  );
}

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent searchParams={props.searchParams} />
    </Suspense>
  );
}
