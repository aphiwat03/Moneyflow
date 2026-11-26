"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import {
  computeRecommendedSalarySplits,
  PLAN_BUCKET_META,
} from "@/lib/salary-plan";
import type {
  ActionResult,
  ComputedAllocationItem,
  PlanBucketType,
  SalaryPlanSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlanRecommendationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SalaryPlanSummary;
  draftTotalIncome: string;
  onOpenSettings: () => void;
  onApplyRecommendedSplit: (params: {
    strategyId: "balanced" | "conservative" | "aggressive_invest";
    replaceExisting?: boolean;
  }) => Promise<ActionResult<unknown>>;
  onNotice: (
    notice: { type: "error" | "success"; message: string } | null
  ) => void;
}

export function PlanRecommendationsDialog({
  open,
  onOpenChange,
  summary,
  draftTotalIncome,
  onOpenSettings,
  onApplyRecommendedSplit,
  onNotice,
}: PlanRecommendationsDialogProps) {
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  const recommendedSplits = useMemo(
    () => computeRecommendedSalarySplits(draftTotalIncome),
    [draftTotalIncome]
  );

  async function handleApplyPreset(
    strategyId: "balanced" | "conservative" | "aggressive_invest"
  ) {
    onNotice(null);
    setApplyingPreset(strategyId);
    try {
      const res = await onApplyRecommendedSplit({
        strategyId,
        replaceExisting: summary.allocations.length > 0,
      });
      if (!res.ok) {
        onNotice({
          type: "error",
          message: res.error ?? "ไม่สามารถใช้สัดส่วนแนะนำได้",
        });
        return;
      }
      onOpenChange(false);
      onNotice({
        type: "success",
        message: "สร้างก้อนเงินออมจากสัดส่วนแนะนำเรียบร้อยแล้ว",
      });
    } finally {
      setApplyingPreset(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span>ตัวช่วยคำนวณ: รายได้รวมเท่านี้ ควรเก็บแต่ละส่วนเท่าไหร่?</span>
          </DialogTitle>
          <DialogDescription>
            คำนวณสัดส่วน เงินเย็น / DCA / ของที่อยากได้ และงบใช้จ่ายจากรายได้รวม{" "}
            <strong className="text-foreground tabular-nums">
              ฿{formatMoneyDisplay(draftTotalIncome)}
            </strong>
          </DialogDescription>
        </DialogHeader>

        {toDecimal(draftTotalIncome).lte(0) ? (
          <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 p-5 text-center">
            <p className="text-sm text-muted-foreground">
              กรุณากรอกเงินเดือนหรือรายได้เสริมก่อน เพื่อให้ระบบคำนวณยอดแนะนำสำหรับ
              เงินเย็น / DCA / ของที่อยากได้
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenSettings();
              }}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              ตั้งค่ารายได้ตอนนี้
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {recommendedSplits.map((preset) => (
              <div
                key={preset.id}
                className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-4"
              >
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold">{preset.title}</p>
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
                      <span>เหลือใช้ ({preset.spendablePct}%)</span>
                      <span className="text-right">
                        ฿{formatMoneyDisplay(preset.spendableAmount)}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          วันละ ~฿
                          {formatMoneyDisplay(preset.dailySpendableEstimate)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={applyingPreset === preset.id}
                  loadingText="กำลังบันทึก..."
                  disabled={applyingPreset !== null}
                  onClick={() => handleApplyPreset(preset.id)}
                  className="w-full"
                >
                  {summary.allocations.length > 0
                    ? "เปลี่ยนมาใช้แผนนี้"
                    : "ใช้แผนแนะนำนี้เลย"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PlanAllocationsListProps {
  summary: SalaryPlanSummary;
  onOpenAddAllocation: (defaultBucket?: PlanBucketType) => void;
  onOpenEditAllocation: (item: ComputedAllocationItem) => void;
  onToggleActive: (item: ComputedAllocationItem) => Promise<void>;
  onDelete: (item: ComputedAllocationItem) => Promise<void>;
}

export function PlanAllocationsList({
  summary,
  onOpenAddAllocation,
  onOpenEditAllocation,
  onToggleActive,
  onDelete,
}: PlanAllocationsListProps) {
  const [busyAllocAction, setBusyAllocAction] = useState<{
    id: string;
    type: "toggle" | "delete";
  } | null>(null);

  async function handleToggleRow(item: ComputedAllocationItem) {
    setBusyAllocAction({ id: item.id, type: "toggle" });
    try {
      await onToggleActive(item);
    } finally {
      setBusyAllocAction(null);
    }
  }

  async function handleDeleteRow(item: ComputedAllocationItem) {
    setBusyAllocAction({ id: item.id, type: "delete" });
    try {
      await onDelete(item);
    } finally {
      setBusyAllocAction(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-4 w-4 text-teal-600" />
            <span>รายการแบ่งก้อนเงินออมและเป้าหมาย</span>
          </CardTitle>
          <CardDescription>
            ตั้งได้ทั้งจำนวนบาทคงที่ เปอร์เซ็นต์ของเงินเดือน
            หรือคำนวณผ่อนเก็บตามราคาเป้าหมาย
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["cold_money", "dca", "wishlist"] as const).map((bType) => (
            <Button
              key={bType}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenAddAllocation(bType)}
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
            ยังไม่ได้ตั้งก้อนเงินออม กดปุ่ม &ldquo;+ เงินเย็น / + DCA / +
            ของที่อยากได้&rdquo; หรือกดปุ่ม &ldquo;ช่วยคำนวณ&rdquo; ด้านบนเพื่อดูสัดส่วนแนะนำได้เลย
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
                          onClick={() => onOpenEditAllocation(item)}
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
                          loading={
                            busyAllocAction?.id === item.id &&
                            busyAllocAction.type === "delete"
                          }
                          disabled={busyAllocAction?.id === item.id}
                          onClick={() => handleDeleteRow(item)}
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
                          {item.targetMonths
                            ? ` (${item.targetMonths} เดือน)`
                            : ""}
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
                              รอโอน ฿
                              {formatMoneyDisplay(item.pendingTransfer)}
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
                      loading={
                        busyAllocAction?.id === item.id &&
                        busyAllocAction.type === "toggle"
                      }
                      loadingText="กำลังบันทึก..."
                      disabled={busyAllocAction?.id === item.id}
                      onClick={() => handleToggleRow(item)}
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
  );
}
