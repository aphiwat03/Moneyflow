"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  SalaryAllocationFormInput,
  SalarySettingsFormInput,
} from "@/actions/salary-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { SmoothExpand } from "@/components/ui/smooth-expand";
import { formatIsoDateForDisplay } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import {
  computeRecommendedSalarySplits,
  computeWishlistMonthlyAmount,
  PLAN_BUCKET_META,
} from "@/lib/salary-plan";
import type {
  ActionResult,
  ComputedAllocationItem,
  PlanAllocationMode,
  PlanBucketType,
  SalaryPlanSummary,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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
  onSaveSettings: (input: SalarySettingsFormInput) => Promise<ActionResult<unknown>>;
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

  // Collapsible salary settings (auto-open only when income hasn't been configured yet)
  const [settingsOpen, setSettingsOpen] = useState(!summary.hasSalaryConfigured);
  const [salaryInput, setSalaryInput] = useState(
    toDecimal(summary.monthlySalary).gt(0) ? summary.monthlySalary : ""
  );
  const [extraIncomeInput, setExtraIncomeInput] = useState(
    toDecimal(summary.extraIncome).gt(0) ? summary.extraIncome : ""
  );
  const [paydayInput, setPaydayInput] = useState(String(summary.payday));
  const [salaryWalletId, setSalaryWalletId] = useState(
    summary.salaryWalletId ?? activeWallets[0]?.id ?? ""
  );
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Recommended split panel
  const [showRecommendations, setShowRecommendations] = useState(
    summary.hasSalaryConfigured && summary.allocations.length === 0
  );
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  // Allocation form dialog state
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [editingAlloc, setEditingAlloc] =
    useState<ComputedAllocationItem | null>(null);
  const [allocName, setAllocName] = useState("");
  const [allocBucket, setAllocBucket] = useState<PlanBucketType>("cold_money");
  const [allocMode, setAllocMode] = useState<PlanAllocationMode>("fixed");
  const [allocValue, setAllocValue] = useState("");
  const [allocTargetTotal, setAllocTargetTotal] = useState("");
  const [allocTargetMonths, setAllocTargetMonths] = useState("");
  const [allocLinkedWalletId, setAllocLinkedWalletId] = useState("");
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSaving, setAllocSaving] = useState(false);

  // One-click transfer confirmation dialog
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [notice, setNotice] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const draftTotalIncome = useMemo(() => {
    try {
      const s = salaryInput.trim() ? toDecimal(salaryInput.trim()) : toDecimal("0");
      const ex = extraIncomeInput.trim()
        ? toDecimal(extraIncomeInput.trim())
        : toDecimal("0");
      const total = s.plus(ex);
      return total.gt(0) ? total.toFixed(2) : summary.totalPlannedIncome;
    } catch {
      return summary.totalPlannedIncome;
    }
  }, [salaryInput, extraIncomeInput, summary.totalPlannedIncome]);

  const recommendedSplits = useMemo(
    () => computeRecommendedSalarySplits(draftTotalIncome),
    [draftTotalIncome]
  );

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

  async function handleSettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSettingsSaving(true);
    try {
      const res = await onSaveSettings({
        monthlySalary: salaryInput.trim() || "0",
        extraIncome: extraIncomeInput.trim() || "0",
        payday: Number(paydayInput) || 1,
        salaryWalletId: salaryWalletId || null,
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setNotice({
          type: "error",
          message: firstErr ?? res.error ?? "บันทึกข้อมูลรายได้ไม่สำเร็จ",
        });
        return;
      }
      setSettingsOpen(false);
      setNotice({
        type: "success",
        message: "บันทึกรายได้ เงินเดือนคงที่ และวันเงินออกเรียบร้อยแล้ว",
      });
    } finally {
      setSettingsSaving(false);
    }
  }

  function openAddAllocation(defaultBucket: PlanBucketType = "cold_money") {
    setEditingAlloc(null);
    setAllocBucket(defaultBucket);
    setAllocName(
      defaultBucket === "cold_money"
        ? "เงินเย็นสำรองฉุกเฉิน"
        : defaultBucket === "dca"
          ? "ลงทุน DCA รายเดือน"
          : defaultBucket === "wishlist"
            ? ""
            : ""
    );
    setAllocMode("fixed");
    setAllocValue("");
    setAllocTargetTotal("");
    setAllocTargetMonths("");
    setAllocLinkedWalletId("");
    setAllocError(null);
    setAllocDialogOpen(true);
  }

  function openEditAllocation(item: ComputedAllocationItem) {
    setEditingAlloc(item);
    setAllocName(item.name);
    setAllocBucket(item.bucketType);
    setAllocMode(item.mode);
    setAllocValue(item.value);
    setAllocTargetTotal(item.targetTotal ?? "");
    setAllocTargetMonths(item.targetMonths ? String(item.targetMonths) : "");
    setAllocLinkedWalletId(item.linkedWalletId ?? "");
    setAllocError(null);
    setAllocDialogOpen(true);
  }

  function handleWishlistCalcChange(nextTotal: string, nextMonths: string) {
    setAllocTargetTotal(nextTotal);
    setAllocTargetMonths(nextMonths);
    const monthsNum = Number(nextMonths);
    if (
      nextTotal.trim() &&
      Number.isInteger(monthsNum) &&
      monthsNum > 0 &&
      allocMode === "fixed"
    ) {
      try {
        const computed = computeWishlistMonthlyAmount(nextTotal.trim(), monthsNum);
        if (computed !== "0.00") {
          setAllocValue(computed);
        }
      } catch {
        // Ignore partial invalid numeric input while typing
      }
    }
  }

  async function handleAllocationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAllocError(null);
    setAllocSaving(true);
    try {
      const payload: SalaryAllocationFormInput = {
        name: allocName,
        bucketType: allocBucket,
        mode: allocMode,
        value: allocValue.trim(),
        targetTotal:
          allocBucket === "wishlist" && allocTargetTotal.trim()
            ? allocTargetTotal.trim()
            : null,
        targetMonths:
          allocBucket === "wishlist" && allocTargetMonths.trim()
            ? Number(allocTargetMonths.trim())
            : null,
        linkedWalletId: allocLinkedWalletId || null,
        isActive: editingAlloc ? editingAlloc.isActive : true,
      };
      const res = await onSaveAllocation(payload, editingAlloc?.id);
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setAllocError(firstErr ?? res.error ?? "บันทึกเป้าหมายไม่สำเร็จ");
        return;
      }
      setAllocDialogOpen(false);
    } finally {
      setAllocSaving(false);
    }
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

  async function handleApplyPreset(
    strategyId: "balanced" | "conservative" | "aggressive_invest"
  ) {
    setNotice(null);
    setApplyingPreset(strategyId);
    try {
      const res = await onApplyRecommendedSplit({
        strategyId,
        replaceExisting: summary.allocations.length > 0,
      });
      if (!res.ok) {
        setNotice({
          type: "error",
          message: res.error ?? "ไม่สามารถใช้สัดส่วนแนะนำได้",
        });
        return;
      }
      setShowRecommendations(false);
      setNotice({
        type: "success",
        message: "สร้างก้อนเงินออมจากสัดส่วนแนะนำเรียบร้อยแล้ว",
      });
    } finally {
      setApplyingPreset(null);
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
    ? toDecimal(summary.bucketTotals.cold_money).div(salaryDec).times(100).toNumber()
    : 0;
  const dcaPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.dca).div(salaryDec).times(100).toNumber()
    : 0;
  const wishPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.wishlist).div(salaryDec).times(100).toNumber()
    : 0;
  const otherPct = salaryDec.gt(0)
    ? toDecimal(summary.bucketTotals.other).div(salaryDec).times(100).toNumber()
    : 0;

  return (
    <div className="space-y-6">
      {/* Header + Month Switcher + Add Goal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            แผนเงินเดือน & เป้าหมายออม
          </h1>
          <p className="text-sm text-muted-foreground">
            แบ่งเงินเย็น DCA ของที่อยากได้ และคำนวณงบคงเหลือใช้จริงต่อวัน
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
            <span>
              เงินออกทุกวันที่ {summary.payday} • รอบคำนวณ{" "}
              {formatIsoDateForDisplay(summary.cycleStartDate)} –{" "}
              {formatIsoDateForDisplay(summary.cycleEndDate)} ({summary.daysInMonth} วัน)
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

      {/* Fixed Monthly Salary & Extra Income Card (Collapsible once set) */}
      <Card>
        <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-teal-600" />
              <span>เงินเดือนคงที่ &amp; รายได้เสริม (Part-time / ฟรีแลนซ์)</span>
            </CardTitle>
            <CardDescription className="mt-1">
              {summary.hasSalaryConfigured ? (
                <span>
                  {toDecimal(summary.monthlySalary).gt(0) ? (
                    <>
                      เงินเดือน{" "}
                      <strong className="text-foreground tabular-nums">
                        ฿{formatMoneyDisplay(summary.monthlySalary)}
                      </strong>
                    </>
                  ) : (
                    <span>ยังไม่ตั้งเงินเดือนคงที่</span>
                  )}
                  {toDecimal(summary.extraIncome).gt(0) ? (
                    <>
                      {" "}
                      + รายได้เสริม{" "}
                      <strong className="text-teal-700 tabular-nums dark:text-teal-300">
                        ฿{formatMoneyDisplay(summary.extraIncome)}
                      </strong>{" "}
                      (รวม{" "}
                      <strong className="text-foreground tabular-nums">
                        ฿{formatMoneyDisplay(summary.totalPlannedIncome)}
                      </strong>
                      )
                    </>
                  ) : null}{" "}
                  • ออกทุกวันที่{" "}
                  <strong className="text-foreground">{summary.payday}</strong>{" "}
                  • รอบคำนวณ{" "}
                  <span className="tabular-nums">
                    {formatIsoDateForDisplay(summary.cycleStartDate)} –{" "}
                    {formatIsoDateForDisplay(summary.cycleEndDate)}
                  </span>
                  {summary.salaryWalletName
                    ? ` • เข้ากระเป๋า ${summary.salaryWalletName}`
                    : ""}
                </span>
              ) : (
                "กรอกเงินเดือนคงที่ หรือใส่เฉพาะรายได้เสริม (เช่น Part-time) เพื่อให้ระบบคำนวณส่วนแบ่งและงบรายวันให้อัตโนมัติ"
              )}
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen((o) => !o)}
            className="w-full shrink-0 gap-1 sm:w-auto"
          >
            <span>{settingsOpen ? "ซ่อน" : "ตั้งค่ารายได้ / วันเงินออก"}</span>
            {settingsOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>

        <SmoothExpand watchKey={settingsOpen}>
          {settingsOpen ? (
            <CardContent className="border-t pt-4">
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    เลือกวันเงินออกด่วน:
                  </span>
                  {[
                    { day: 1, label: "ทุกวันที่ 1" },
                    { day: 5, label: "วันที่ 5" },
                    { day: 15, label: "วันที่ 15" },
                    { day: 25, label: "วันที่ 25" },
                    { day: 31, label: "สิ้นเดือน (31)" },
                  ].map((preset) => {
                    const active = Number(paydayInput) === preset.day;
                    return (
                      <button
                        key={preset.day}
                        type="button"
                        onClick={() => setPaydayInput(String(preset.day))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="salary-monthly">
                      เงินเดือนคงที่ (บาท/เดือน)
                    </Label>
                    <Input
                      id="salary-monthly"
                      inputMode="decimal"
                      placeholder="0 (ถ้ายังไม่เริ่มงาน)"
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="salary-extra">
                        รายได้เสริม / Part-time (บาท)
                      </Label>
                      {toDecimal(summary.periodIncome).gt(0) ? (
                        <button
                          type="button"
                          onClick={() => setExtraIncomeInput(summary.periodIncome)}
                          className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                        >
                          ใช้ยอดที่จด (฿{formatMoneyDisplay(summary.periodIncome)})
                        </button>
                      ) : null}
                    </div>
                    <Input
                      id="salary-extra"
                      inputMode="decimal"
                      placeholder="เช่น 2500"
                      value={extraIncomeInput}
                      onChange={(e) => setExtraIncomeInput(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="salary-payday">วันที่เงินเดือนออก (1–31)</Label>
                    <AppSelect
                      id="salary-payday"
                      value={paydayInput}
                      onValueChange={setPaydayInput}
                      options={Array.from({ length: 31 }, (_, idx) => {
                        const d = idx + 1;
                        return {
                          value: String(d),
                          label:
                            d === 31
                              ? "วันที่ 31 (หรือวันสิ้นเดือน)"
                              : `วันที่ ${d} ของทุกเดือน`,
                        };
                      })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="salary-wallet">
                      กระเป๋ารับเงิน (ไม่บังคับ)
                    </Label>
                    <AppSelect
                      id="salary-wallet"
                      value={salaryWalletId}
                      onValueChange={setSalaryWalletId}
                      options={[
                        { value: "", label: "ไม่ระบุ" },
                        ...activeWallets.map((w) => ({
                          value: w.id,
                          label: w.name,
                          dotColor: w.color ?? "#0f766e",
                        })),
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    ยอดรวมที่ใช้คำนวณแผน:{" "}
                    <strong className="text-foreground tabular-nums">
                      ฿{formatMoneyDisplay(draftTotalIncome)}
                    </strong>{" "}
                    (ยังไม่ต้องมีเงินเดือนคงที่ก็ใส่เฉพาะช่องรายได้เสริมได้)
                  </p>
                  <Button
                    type="submit"
                    disabled={settingsSaving}
                    className="h-10 bg-teal-700 px-6 text-white hover:bg-teal-800"
                  >
                    {settingsSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                  </Button>
                </div>
              </form>
            </CardContent>
          ) : null}
        </SmoothExpand>
      </Card>

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
            <span className={spendableDec.lt(0) ? "text-rose-600 font-medium" : ""}>
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
                  <span className="ml-1 text-rose-600 font-medium">• เกินงบวันนี้</span>
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
                  ยอดแบ่งเก็บทั้งหมด (฿{formatMoneyDisplay(summary.totalAllocated)})
                  มากกว่ารายได้รวมในแผน (฿{formatMoneyDisplay(summary.totalPlannedIncome)})
                  กรุณาลดเป้าหมายบางส่วนเพื่อให้มีงบใช้จ่ายในชีวิตประจำวัน
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium">
                สัดส่วนการจัดสรรรายได้รวม (฿{formatMoneyDisplay(summary.totalPlannedIncome)})
              </span>
              <span className="text-muted-foreground tabular-nums">
                ออมและลงทุน {summary.allocationRatioPct}% • งบใช้จ่าย{" "}
                {Math.max(0, Number((100 - summary.allocationRatioPct).toFixed(1)))}%
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

      {/* One-Click Payday Allocation Transfer Banner */}
      {summary.pendingTransferCount > 0 ? (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  มีรายการออมที่ผูกกระเป๋าไว้ รอโอนเดือนนี้ {summary.pendingTransferCount} ก้อน
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  ยอดรวมรอโอน ฿{formatMoneyDisplay(summary.pendingTransferTotal)}{" "}
                  {summary.salaryWalletName
                    ? `(โอนจาก ${summary.salaryWalletName})`
                    : "(กรุณาเลือกกระเป๋ารับเงินเดือนด้านบนก่อนกดโอน)"}
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={!summary.salaryWalletId}
              onClick={() => setTransferConfirmOpen(true)}
              className="shrink-0 bg-sky-600 text-white hover:bg-sky-700"
            >
              โอนตามแผนเข้ากระเป๋าเลย
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Recommended Split Calculator */}
      <Card>
        <CardHeader className="flex flex-col gap-2.5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>ตัวช่วยคำนวณ: รายได้รวมเท่านี้ ควรเก็บแต่ละส่วนเท่าไหร่?</span>
            </CardTitle>
            <CardDescription>
              คำนวณสัดส่วน เงินเย็น / DCA / ของที่อยากได้ และงบใช้จ่ายจากรายได้รวม{" "}
              ฿{formatMoneyDisplay(draftTotalIncome)}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRecommendations((s) => !s)}
            className="w-full shrink-0 sm:w-auto"
          >
            {showRecommendations ? "ซ่อนคำแนะนำ" : "ดูสัดส่วนแนะนำ"}
          </Button>
        </CardHeader>

        <SmoothExpand watchKey={showRecommendations}>
          {showRecommendations ? (
            <CardContent className="border-t pt-4">
              {toDecimal(draftTotalIncome).lte(0) ? (
                <p className="text-sm text-muted-foreground">
                  กรุณากรอกเงินเดือนหรือรายได้เสริมด้านบนก่อน เพื่อคำนวณยอดแนะนำสำหรับ เงินเย็น / DCA / ของที่อยากได้
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-3">
                  {recommendedSplits.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-4"
                    >
                      <div className="space-y-2">
                        <div>
                          <p className="font-semibold text-sm">{preset.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {preset.subtitle}
                          </p>
                        </div>
                        <div className="space-y-1 border-t pt-2 text-xs tabular-nums">
                          <div className="flex justify-between">
                            <span className="text-sky-600">
                              เงินเย็น ({preset.coldMoneyPct}%)
                            </span>
                            <span className="font-semibold">
                              ฿{formatMoneyDisplay(preset.coldMoneyAmount)}/ด.
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-600">
                              ลงทุน DCA ({preset.dcaPct}%)
                            </span>
                            <span className="font-semibold">
                              ฿{formatMoneyDisplay(preset.dcaAmount)}/ด.
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-orange-600">
                              ของที่อยากได้ ({preset.wishlistPct}%)
                            </span>
                            <span className="font-semibold">
                              ฿{formatMoneyDisplay(preset.wishlistAmount)}/ด.
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>เหลือใช้ต่อเดือน ({preset.spendablePct}%)</span>
                            <span>
                              ฿{formatMoneyDisplay(preset.spendableAmount)} (วันละ ~฿
                              {formatMoneyDisplay(preset.dailySpendableEstimate)})
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={applyingPreset !== null}
                        onClick={() => handleApplyPreset(preset.id)}
                        className="w-full"
                      >
                        {applyingPreset === preset.id
                          ? "กำลังสร้างแผน..."
                          : summary.allocations.length > 0
                            ? "เปลี่ยนมาใช้แผนนี้"
                            : "ใช้แผนแนะนำนี้เลย"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : null}
        </SmoothExpand>
      </Card>

      {/* Allocation Buckets List */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4 text-teal-600" />
              <span>รายการแบ่งก้อนเงินออมและเป้าหมาย</span>
            </CardTitle>
            <CardDescription>
              ตั้งได้ทั้งจำนวนบาทคงที่ เปอร์เซ็นต์ของเงินเดือน หรือคำนวณผ่อนเก็บตามราคาเป้าหมาย
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["cold_money", "dca", "wishlist"] as const).map((bType) => (
              <Button
                key={bType}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openAddAllocation(bType)}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{PLAN_BUCKET_META[bType].shortLabel}</span>
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {summary.allocations.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              ยังไม่ได้ตั้งก้อนเงินออม กดปุ่ม &ldquo;+ เงินเย็น / + DCA / + ของที่อยากได้&rdquo;
              หรือเลือกจากสัดส่วนแนะนำด้านบนได้เลย
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {summary.allocations.map((item) => {
                const meta = PLAN_BUCKET_META[item.bucketType];
                const monthlyDec = toDecimal(item.monthlyAmount);
                const transferredDec = toDecimal(item.transferredThisMonth);
                const pctTransferred =
                  monthlyDec.gt(0) && item.linkedWalletId
                    ? Math.min(
                        100,
                        transferredDec.div(monthlyDec).times(100).toNumber()
                      )
                    : 0;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex flex-col justify-between gap-3 rounded-xl border bg-background p-4",
                      !item.isActive && "opacity-60"
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[11px]"
                              style={{
                                borderColor: `${meta.color}55`,
                                color: meta.color,
                              }}
                            >
                              {meta.shortLabel}
                            </Badge>
                            {!item.isActive ? (
                              <Badge variant="secondary" className="text-[10px]">
                                พักชั่วคราว
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate font-semibold">{item.name}</p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 max-lg:gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9"
                            aria-label="แก้ไขเป้าหมาย"
                            title="แก้ไข"
                            onClick={() => openEditAllocation(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9 text-destructive hover:text-destructive"
                            aria-label="ลบเป้าหมาย"
                            title="ลบ"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between border-t pt-2">
                        <span className="text-xs text-muted-foreground">
                          {item.mode === "percent"
                            ? `${toDecimal(item.value).toString()}% ของรายได้รวม`
                            : "ยอดคงที่ต่อเดือน"}
                        </span>
                        <span className="text-lg font-bold tabular-nums">
                          ฿{formatMoneyDisplay(item.monthlyAmount)}
                          <span className="text-xs font-normal text-muted-foreground">
                            /ด.
                          </span>
                        </span>
                      </div>

                      {item.targetTotal ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                          <Target className="h-3.5 w-3.5 text-orange-500" />
                          <span>
                            ราคาเป้า ฿{formatMoneyDisplay(item.targetTotal)}
                            {item.targetMonths ? ` (${item.targetMonths} เดือน)` : ""}
                          </span>
                        </p>
                      ) : null}

                      {item.linkedWalletName ? (
                        <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">
                              ผูก: {item.linkedWalletName}
                            </span>
                            {item.isCompletedThisMonth ? (
                              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                โอนครบแล้ว
                              </span>
                            ) : (
                              <span className="shrink-0 text-amber-600 tabular-nums">
                                รอโอน ฿{formatMoneyDisplay(item.pendingTransfer)}
                              </span>
                            )}
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                item.isCompletedThisMonth
                                  ? "bg-emerald-500"
                                  : "bg-sky-500"
                              )}
                              style={{ width: `${pctTransferred}%` }}
                            />
                          </div>
                          {item.linkedWalletBalance !== null ? (
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              ยอดสะสมในกระเป๋าตอนนี้: ฿
                              {formatMoneyDisplay(item.linkedWalletBalance)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex justify-end border-t pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(item)}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        {item.isActive ? "พักก้อนนี้ชั่วคราว" : "เปิดใช้งานอีกครั้ง"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Allocation Dialog */}
      <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAlloc ? "แก้ไขก้อนเงินออม / เป้าหมาย" : "เพิ่มก้อนเงินออม / เป้าหมาย"}
            </DialogTitle>
            <DialogDescription>
              แบ่งส่วนจากเงินเดือนเป็น เงินเย็น ลงทุน DCA หรือเก็บซื้อของที่อยากได้
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAllocationSubmit} className="space-y-4">
            {allocError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {allocError}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="alloc-bucket">ประเภทเป้าหมาย</Label>
                <AppSelect
                  id="alloc-bucket"
                  value={allocBucket}
                  onValueChange={(nextValue) =>
                    setAllocBucket(nextValue as PlanBucketType)
                  }
                  options={[
                    {
                      value: "cold_money",
                      label: "เงินเย็น (ออมสำรอง)",
                      dotColor: "#0ea5e9",
                    },
                    {
                      value: "dca",
                      label: "ลงทุน DCA รายเดือน",
                      dotColor: "#10b981",
                    },
                    {
                      value: "wishlist",
                      label: "ของที่อยากได้ (Wishlist)",
                      dotColor: "#f97316",
                    },
                    {
                      value: "other",
                      label: "เป้าหมายอื่นๆ",
                      dotColor: "#8b5cf6",
                    },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alloc-mode">รูปแบบการหักต่อเดือน</Label>
                <AppSelect
                  id="alloc-mode"
                  value={allocMode}
                  onValueChange={(nextValue) =>
                    setAllocMode(nextValue as PlanAllocationMode)
                  }
                  options={[
                    { value: "fixed", label: "จำนวนเงินคงที่ (บาท)" },
                    { value: "percent", label: "เปอร์เซ็นต์ของรายได้รวม (%)" },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alloc-name">ชื่อเป้าหมาย</Label>
              <Input
                id="alloc-name"
                value={allocName}
                onChange={(e) => setAllocName(e.target.value)}
                placeholder={
                  allocBucket === "wishlist"
                    ? "เช่น iPad Air, ทริปญี่ปุ่น"
                    : "เช่น เงินเย็นฉุกเฉิน, DCA S&P500"
                }
                className="h-10"
                required
              />
            </div>

            {allocBucket === "wishlist" ? (
              <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
                  ตัวช่วยคำนวณผ่อนเก็บซื้อของที่อยากได้ (ไม่บังคับ)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="alloc-target-total" className="text-xs">
                      ราคาเต็มของที่อยากได้ (บาท)
                    </Label>
                    <Input
                      id="alloc-target-total"
                      inputMode="decimal"
                      value={allocTargetTotal}
                      onChange={(e) =>
                        handleWishlistCalcChange(
                          e.target.value,
                          allocTargetMonths
                        )
                      }
                      placeholder="เช่น 24000"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="alloc-target-months" className="text-xs">
                      อยากได้ในกี่เดือน
                    </Label>
                    <Input
                      id="alloc-target-months"
                      inputMode="numeric"
                      value={allocTargetMonths}
                      onChange={(e) =>
                        handleWishlistCalcChange(
                          allocTargetTotal,
                          e.target.value
                        )
                      }
                      placeholder="เช่น 12"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="alloc-value">
                  {allocMode === "percent"
                    ? "สัดส่วน (% ของรายได้รวม)"
                    : "จำนวนเงินที่เก็บต่อเดือน (บาท)"}
                </Label>
                <Input
                  id="alloc-value"
                  inputMode="decimal"
                  value={allocValue}
                  onChange={(e) => setAllocValue(e.target.value)}
                  placeholder={allocMode === "percent" ? "เช่น 10" : "เช่น 5000"}
                  className="h-10"
                  required
                />
                {allocMode === "percent" &&
                summary.hasSalaryConfigured &&
                allocValue.trim() ? (
                  <p className="text-[11px] text-teal-700 dark:text-teal-300 tabular-nums">
                    คิดเป็น ฿
                    {formatMoneyDisplay(
                      toDecimal(summary.totalPlannedIncome)
                        .times(toDecimal(allocValue || "0"))
                        .div(100)
                    )}{" "}
                    / เดือน
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alloc-wallet">
                  ผูกกระเป๋าปลายทาง (ติดตามยอดโอน)
                </Label>
                <AppSelect
                  id="alloc-wallet"
                  value={allocLinkedWalletId}
                  onValueChange={setAllocLinkedWalletId}
                  options={[
                    { value: "", label: "ไม่ผูกกระเป๋า" },
                    ...activeWallets.map((w) => ({
                      value: w.id,
                      label: w.name,
                      dotColor: w.color ?? "#0f766e",
                    })),
                  ]}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAllocDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={allocSaving}>
                {allocSaving ? "กำลังบันทึก..." : "บันทึกเป้าหมาย"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm One-Click Monthly Allocation Transfers Dialog */}
      <Dialog
        open={transferConfirmOpen}
        onOpenChange={setTransferConfirmOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการโอนเงินตามแผน ({monthLabel})</DialogTitle>
            <DialogDescription>
              ระบบจะสร้างรายการโอนย้าย (Transfer) จาก{" "}
              <strong>{summary.salaryWalletName}</strong> ไปยังกระเป๋าเป้าหมายต่อไปนี้:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs">
            {pendingAllocations.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {a.name} → <strong>{a.linkedWalletName}</strong>
                </span>
                <span className="shrink-0 font-semibold text-sky-600 tabular-nums">
                  ฿{formatMoneyDisplay(a.pendingTransfer)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2 font-semibold">
              <span>รวมทั้งสิ้น</span>
              <span className="tabular-nums">
                ฿{formatMoneyDisplay(summary.pendingTransferTotal)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferConfirmOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              disabled={transferring}
              onClick={handleConfirmMonthlyTransfer}
              className="bg-sky-600 text-white hover:bg-sky-700"
            >
              {transferring ? "กำลังสร้างรายการโอน..." : "ยืนยันโอนตามแผน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
