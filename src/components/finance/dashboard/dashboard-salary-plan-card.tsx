"use client";

import { CalendarDays, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatIsoDateForDisplay } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import { PLAN_BUCKET_META } from "@/lib/salary-plan";
import type { SalaryPlanSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardSalaryPlanCardProps {
  salaryPlan: SalaryPlanSummary;
  monthLabel: string;
  onOpenPlan?: () => void;
}

export function DashboardSalaryPlanCard({
  salaryPlan,
  monthLabel,
  onOpenPlan,
}: DashboardSalaryPlanCardProps) {
  return (
    <Card className="border-teal-600/25 bg-card">
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-4 w-4 text-teal-600" />
            <span>แผนเงินเดือน &amp; ยอดใช้จ่ายวันนี้</span>
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
            {salaryPlan.hasSalaryConfigured
              ? "จัดการแผนเงินเดือน"
              : "ตั้งแผนเงินเดือน"}
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
                    วันนี้ใช้ไปแล้ว (
                    {formatIsoDateForDisplay(salaryPlan.todayDate)})
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
                          <span className="font-semibold text-emerald-600">
                            ✓
                          </span>
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
                เริ่มตั้งเงินเดือน &amp; เป้าหมายออม →
              </button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
