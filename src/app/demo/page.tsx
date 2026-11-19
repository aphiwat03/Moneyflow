import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DemoWorkspace } from "@/components/finance/demo-workspace";
import { getBangkokYearMonth } from "@/lib/date";
import { createDemoTransactions } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "ทดลองใช้งาน UI",
};

async function DemoLoader() {
  await connection();
  const now = new Date();
  const ym = getBangkokYearMonth(now);
  const initialTransactions = createDemoTransactions(now);

  return (
    <DemoWorkspace
      initialYear={ym.year}
      initialMonth={ym.month}
      initialTransactions={initialTransactions}
    />
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div className="h-12 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <DemoLoader />
    </Suspense>
  );
}
