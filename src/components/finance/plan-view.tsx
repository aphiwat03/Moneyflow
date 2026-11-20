"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type {
  SalaryAllocationFormInput,
  SalarySettingsFormInput,
} from "@/actions/salary-plan";
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
import type {
  ActionResult,
  ComputedAllocationItem,
  PlanBucketType,
  SalaryPlanSummary,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PlanAllocationDialog,
  PlanTransferConfirmDialog,
} from "./plan/plan-allocation-dialog";
import { PlanAllocationsList } from "./plan/plan-allocations-list";
import { PlanSettingsCard } from "./plan/plan-settings-card";

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

interface PlanViewProps {
  summary: SalaryPlanSummary;
  wallets: WalletDTO[];
  onChangeMonth: (year: number, month: number) => void;
  onSaveSettings: (
    input: SalarySettingsFormInput
  ) => Promise<ActionResult<unknown>>;
  onSaveAllocation: (
    input: SalaryAllocationFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
  onDeleteAllocation: (allocationId: string) => Promise<ActionResult<unknown>>;
  onApplyRecommendedSplit: (params: {
    strategyId: "balanced" | "conservative" | "aggressive_invest";
    replaceExisting?: boolean;
  }) => Promise<ActionResult<unknown>>;
  onExecuteMonthlyTransfers: (params: {
    year: number;
    month: number;
  }) => Promise<ActionResult<{ createdCount: number; totalTransferred: string }>>;
}

export function PlanView({
  summary,
  wallets,
  onChangeMonth,
  onSaveSettings,
  onSaveAllocation,
  onDeleteAllocation,
  onApplyRecommendedSplit,
  onExecuteMonthlyTransfers,
}: PlanViewProps) {
  const activeWallets = wallets.filter((w) => !w.isArchived);
  const monthLabel = `${THAI_MONTHS[summary.selectedMonth - 1]} ${summary.selectedYear + 543}`;

  const [salaryInput, setSalaryInput] = useState(
    toDecimal(summary.monthlySalary).gt(0) ? summary.monthlySalary : ""
  );
  const [extraIncomeInput, setExtraIncomeInput] = useState(
    toDecimal(summary.extraIncome).gt(0) ? summary.extraIncome : ""
  );

  // Allocation dialog state
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [allocFormKey, setAllocFormKey] = useState(0);
  const [editingAlloc, setEditingAlloc] =
    useState<ComputedAllocationItem | null>(null);
  const [defaultBucket, setDefaultBucket] =
    useState<PlanBucketType>("cold_money");

  // One-click transfer confirmation dialog
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [notice, setNotice] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const draftTotalIncome = useMemo(() => {
    try {
      const s = salaryInput.trim()
        ? toDecimal(salaryInput.trim())
        : toDecimal("0");
      const ex = extraIncomeInput.trim()
        ? toDecimal(extraIncomeInput.trim())
        : toDecimal("0");
      const total = s.plus(ex);
      return total.gt(0) ? total.toFixed(2) : summary.totalPlannedIncome;
    } catch {
      return summary.totalPlannedIncome;
    }
  }, [salaryInput, extraIncomeInput, summary.totalPlannedIncome]);

  const remainingDec = toDecimal(summary.remainingToSpend);
  const spendableDec = toDecimal(summary.spendableBudget);
  const todayRemainingDec = toDecimal(summary.todayRemaining);
  const salaryDec = toDecimal(summary.totalPlannedIncome);

  const pendingAllocations = summary.allocations.filter(
    (a) =>
      a.isActive &&
      a.linkedWalletId &&
      a.linkedWalletId !== summary.salaryWalletId &&
      toDecimal(a.pendingTransfer).gt(0)
  );

  function goPrevMonth() {
    if (summary.selectedMonth === 1) {
      onChangeMonth(summary.selectedYear - 1, 12);
    } else {
      onChangeMonth(summary.selectedYear, summary.selectedMonth - 1);
    }
  }

  function goNextMonth() {
    if (summary.selectedMonth === 12) {
      onChangeMonth(summary.selectedYear + 1, 1);
    } else {
      onChangeMonth(summary.selectedYear, summary.selectedMonth + 1);
    }
  }

  function openAddAllocation(bucket: PlanBucketType = "cold_money") {
    setEditingAlloc(null);
    setDefaultBucket(bucket);
    setAllocFormKey((k) => k + 1);
    setAllocDialogOpen(true);
  }

  function openEditAllocation(item: ComputedAllocationItem) {
    setEditingAlloc(item);
    setDefaultBucket(item.bucketType);
    setAllocFormKey((k) => k + 1);
    setAllocDialogOpen(true);
  }

  async function handleToggleActive(item: ComputedAllocationItem) {
    setNotice(null);
    const res = await onSaveAllocation(
      {
        name: item.name,
        bucketType: item.bucketType,
        mode: item.mode,
        value: item.value,
        targetTotal: item.targetTotal,
        targetMonths: item.targetMonths,
        linkedWalletId: item.linkedWalletId,
        isActive: !item.isActive,
      },
      item.id
    );
    if (!res.ok) {
      setNotice({
        type: "error",
        message: res.error ?? "อัปเดตสถานะไม่สำเร็จ",
      });
    }
  }

  async function handleDelete(item: ComputedAllocationItem) {
    setNotice(null);
    const res = await onDeleteAllocation(item.id);
    if (!res.ok) {
      setNotice({
        type: "error",
        message: res.error ?? "ลบเป้าหมายไม่สำเร็จ",
      });
    }
  }

  async function handleConfirmMonthlyTransfer() {
    setTransferring(true);
    setNotice(null);
    try {
      const res = await onExecuteMonthlyTransfers({
        year: summary.selectedYear,
        month: summary.selectedMonth,
      });
      if (!res.ok) {
        setNotice({
          type: "error",
          message: res.error ?? "โอนตามแผนไม่สำเร็จ",
        });
        return;
      }
      setTransferConfirmOpen(false);
      setNotice({
        type: "success",
        message: `สร้างรายการโอนตามแผนแล้ว ${res.data?.createdCount ?? 0} รายการ (รวม ฿${formatMoneyDisplay(res.data?.totalTransferred ?? "0")})`,
      });
    } finally {
      setTransferring(false);
    }
  }

  // Stacked allocation proportion percentages for the visual bar
  const coldPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.cold_money)
        .div(salaryDec)
        .times(100)
        .toNumber()
    : 0;
  const dcaPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.dca).div(salaryDec).times(100).toNumber()
    : 0;
  const wishPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.wishlist)
        .div(salaryDec)
        .times(100)
        .toNumber()
    : 0;
  const otherPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.other)
        .div(salaryDec)
        .times(100)
        .toNumber()
    : 0;

  return (
    <div className="space-y-6">
      {/* Header + Month Switcher + Add Goal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            แผนเงินเดือน &amp; เป้าหมายออม
          </h1>
          <p className="text-sm text-muted-foreground">
            แบ่งเงินเย็น DCA ของที่อยากได้ และคำนวณงบคงเหลือใช้จริงต่อวัน
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
            <span>
              เงินออกทุกวันที่ {summary.payday} • รอบคำนวณ{" "}
              {formatIsoDateForDisplay(summary.cycleStartDate)} –{" "}
              {formatIsoDateForDisplay(summary.cycleEndDate)} (
              {summary.daysInMonth} วัน)
            </span>
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
            onClick={() => openAddAllocation("cold_money")}
            className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มเป้าหมาย</span>
          </Button>
        </div>
      </div>

      {notice ? (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            notice.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          )}
        >
          {notice.message}
        </div>
      ) : null}

      {/* Fixed Monthly Salary & Extra Income Card */}
      <PlanSettingsCard
        summary={summary}
        activeWallets={activeWallets}
        salaryInput={salaryInput}
        extraIncomeInput={extraIncomeInput}
        draftTotalIncome={draftTotalIncome}
        onSalaryInputChange={setSalaryInput}
        onExtraIncomeInputChange={setExtraIncomeInput}
        onSaveSettings={onSaveSettings}
        onNotice={setNotice}
      />

      {/* Main Waterfall & Daily Allowance Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {toDecimal(summary.extraIncome).gt(0)
                ? "1. รายได้รวมในแผน"
                : "1. เงินเดือนคงที่"}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              ฿{formatMoneyDisplay(summary.totalPlannedIncome)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            {toDecimal(summary.extraIncome).gt(0) ? (
              <span>
                เงินเดือน ฿{formatMoneyDisplay(summary.monthlySalary)} + เสริม ฿
                {formatMoneyDisplay(summary.extraIncome)}
                {toDecimal(summary.periodIncome).gt(0)
                  ? ` • จดรับจริง +฿${formatMoneyDisplay(summary.periodIncome)}`
                  : ""}
              </span>
            ) : toDecimal(summary.periodIncome).gt(0) ? (
              `รายรับที่จดในเดือนนี้: +฿${formatMoneyDisplay(summary.periodIncome)}`
            ) : (
              `เงินออกวันที่ ${summary.payday} ของเดือน`
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              2. แบ่งเก็บทั้งหมด ({summary.allocationRatioPct}%)
            </CardDescription>
            <CardTitle className="text-2xl text-sky-600 tabular-nums">
              -฿{formatMoneyDisplay(summary.totalAllocated)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            เย็น ฿{formatMoneyDisplay(summary.bucketTotals.cold_money)} • DCA ฿
            {formatMoneyDisplay(summary.bucketTotals.dca)} • อยากได้ ฿
            {formatMoneyDisplay(summary.bucketTotals.wishlist)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>3. คงเหลือใช้จ่ายได้จริงตอนนี้</CardDescription>
            <CardTitle
              className={cn(
                "text-2xl tabular-nums",
                remainingDec.gte(0) ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {remainingDec.gte(0) ? "" : "-"}฿
              {formatMoneyDisplay(remainingDec.abs())}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            งบใช้ได้ทั้งเดือน{" "}
            <span
              className={spendableDec.lt(0) ? "font-medium text-rose-600" : ""}
            >
              ฿{formatMoneyDisplay(summary.spendableBudget)}
            </span>{" "}
            − ใช้ไปแล้ว ฿{formatMoneyDisplay(summary.periodExpense)}
          </CardContent>
        </Card>

        <Card className="border-teal-600/30 bg-teal-700/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
              <CalendarDays className="h-4 w-4" />
              งบใช้ได้เฉลี่ยต่อวัน
            </CardDescription>
            <CardTitle className="text-2xl text-teal-700 tabular-nums dark:text-teal-300">
              ฿{formatMoneyDisplay(summary.dailyAllowance)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / วัน
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            {summary.daysRemaining > 0 ? (
              <>
                วันนี้ใช้ไป{" "}
                <strong className="text-foreground">
                  ฿{formatMoneyDisplay(summary.todayExpense)}
                </strong>{" "}
                (จากอีก {summary.daysRemaining} วัน)
                {todayRemainingDec.lt(0) ? (
                  <span className="ml-1 font-medium text-rose-600">
                    • เกินงบวันนี้
                  </span>
                ) : null}
              </>
            ) : (
              "เดือนนี้สิ้นสุดแล้ว"
            )}
          </CardContent>
        </Card>
      </div>

      {/* Over-allocated warning + Visual Proportion Bar */}
      {summary.hasSalaryConfigured ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            {summary.isOverAllocated ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  ยอดแบ่งเก็บทั้งหมด (฿
                  {formatMoneyDisplay(summary.totalAllocated)})
                  มากกว่ารายได้รวมในแผน (฿
                  {formatMoneyDisplay(summary.totalPlannedIncome)})
                  กรุณาลดเป้าหมายบางส่วนเพื่อให้มีงบใช้จ่ายในชีวิตประจำวัน
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium">
                สัดส่วนการจัดสรรรายได้รวม (฿
                {formatMoneyDisplay(summary.totalPlannedIncome)})
              </span>
              <span className="text-muted-foreground tabular-nums">
                ออมและลงทุน {summary.allocationRatioPct}% • งบใช้จ่าย{" "}
                {Math.max(
                  0,
                  Number((100 - summary.allocationRatioPct).toFixed(1))
                )}
                %
              </span>
            </div>

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {coldPct > 0 ? (
                <div
                  style={{ width: `${Math.min(100, coldPct)}%` }}
                  className="bg-sky-500 transition-all"
                  title={`เงินเย็น ${coldPct.toFixed(1)}%`}
                />
              ) : null}
              {dcaPct > 0 ? (
                <div
                  style={{ width: `${Math.min(100, dcaPct)}%` }}
                  className="bg-emerald-500 transition-all"
                  title={`DCA ${dcaPct.toFixed(1)}%`}
                />
              ) : null}
              {wishPct > 0 ? (
                <div
                  style={{ width: `${Math.min(100, wishPct)}%` }}
                  className="bg-orange-500 transition-all"
                  title={`ของที่อยากได้ ${wishPct.toFixed(1)}%`}
                />
              ) : null}
              {otherPct > 0 ? (
                <div
                  style={{ width: `${Math.min(100, otherPct)}%` }}
                  className="bg-violet-500 transition-all"
                  title={`อื่นๆ ${otherPct.toFixed(1)}%`}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                เงินเย็น ({coldPct.toFixed(1)}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                DCA ({dcaPct.toFixed(1)}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                ของที่อยากได้ ({wishPct.toFixed(1)}%)
              </span>
              {otherPct > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  อื่นๆ ({otherPct.toFixed(1)}%)
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                งบใช้จ่ายรายเดือน
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Transfer Banner, Recommended Splits & Allocation Buckets */}
      <PlanAllocationsList
        summary={summary}
        draftTotalIncome={draftTotalIncome}
        onOpenTransferConfirm={() => setTransferConfirmOpen(true)}
        onOpenAddAllocation={openAddAllocation}
        onOpenEditAllocation={openEditAllocation}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onApplyRecommendedSplit={onApplyRecommendedSplit}
        onNotice={setNotice}
      />

      {/* Add / Edit Allocation Dialog */}
      <PlanAllocationDialog
        open={allocDialogOpen}
        formKey={allocFormKey}
        summary={summary}
        activeWallets={activeWallets}
        editingAlloc={editingAlloc}
        defaultBucket={defaultBucket}
        onOpenChange={setAllocDialogOpen}
        onSaveAllocation={onSaveAllocation}
      />

      {/* Confirm One-Click Monthly Allocation Transfers Dialog */}
      <PlanTransferConfirmDialog
        open={transferConfirmOpen}
        onOpenChange={setTransferConfirmOpen}
        summary={summary}
        monthLabel={monthLabel}
        pendingAllocations={pendingAllocations}
        transferring={transferring}
        onConfirm={handleConfirmMonthlyTransfer}
      />
    </div>
  );
}
