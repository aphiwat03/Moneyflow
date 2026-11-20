"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
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
import { SmoothExpand } from "@/components/ui/smooth-expand";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIsoDateForDisplay } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import {
  INVESTMENT_ASSET_TYPE_META,
  POPULAR_DCA_PRESETS,
  type InvestmentHoldingPreset,
} from "@/lib/investment-calc";
import type {
  InvestmentDcaLogDTO,
  InvestmentHoldingDTO,
  InvestmentPortfolioSummary,
  InvestmentSnapshotDTO,
  MonthlyDcaChecklistSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatMonthKeyThai } from "./investment-dialogs";

interface InvestmentHoldingsSectionProps {
  isDbMode: boolean;
  isMutating: boolean;
  isRefreshingPrices: boolean;
  currentMonthKey: string;
  holdings: InvestmentHoldingDTO[];
  portfolio: InvestmentPortfolioSummary;
  monthlyChecklist: MonthlyDcaChecklistSummary;
  dcaLogs: InvestmentDcaLogDTO[];
  sortedSnapshots: InvestmentSnapshotDTO[];
  existingSymbolSet: Set<string>;
  onOpenAddHolding: () => void;
  onOpenEditHolding: (item: InvestmentHoldingDTO) => void;
  onDeleteHolding: (id: string) => Promise<void>;
  onQuickAddPreset: (preset: InvestmentHoldingPreset) => Promise<void>;
  onOpenRecordDca: (
    holding: InvestmentHoldingDTO,
    suggestedAmount?: string
  ) => void;
  onDeleteDcaLog: (log: InvestmentDcaLogDTO) => Promise<void>;
  onOpenRecordDividend: (holding: InvestmentHoldingDTO) => void;
  onRefreshPrices: () => Promise<void>;
  onOpenAddSnapshot: () => void;
  onDeleteSnapshot: (id: string) => Promise<void>;
  onUseSnapshotAsPrincipal: (snap: InvestmentSnapshotDTO) => void;
}

export function InvestmentHoldingsSection({
  isDbMode,
  isMutating,
  isRefreshingPrices,
  currentMonthKey,
  holdings,
  portfolio,
  monthlyChecklist,
  dcaLogs,
  sortedSnapshots,
  existingSymbolSet,
  onOpenAddHolding,
  onOpenEditHolding,
  onDeleteHolding,
  onQuickAddPreset,
  onOpenRecordDca,
  onDeleteDcaLog,
  onOpenRecordDividend,
  onRefreshPrices,
  onOpenAddSnapshot,
  onDeleteSnapshot,
  onUseSnapshotAsPrincipal,
}: InvestmentHoldingsSectionProps) {
  const [dcaLogsExpanded, setDcaLogsExpanded] = useState(false);

  return (
    <>
      {/* Monthly DCA Checklist & Execution Log */}
      {holdings.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                <span>
                  เช็กลิสต์ DCA เดือน {formatMonthKeyThai(currentMonthKey)}
                </span>
              </CardTitle>
              <CardDescription>
                ซื้อแล้ว {monthlyChecklist.completedCount}/
                {monthlyChecklist.totalCount} รายการ • ยอดซื้อรวม ฿
                {formatMoneyDisplay(monthlyChecklist.totalBoughtThb)} / แผน ฿
                {formatMoneyDisplay(monthlyChecklist.totalPlannedThb)}
              </CardDescription>
            </div>
            {dcaLogs.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDcaLogsExpanded((prev) => !prev)}
                className="w-full shrink-0 gap-1.5 sm:w-auto"
              >
                <History className="h-3.5 w-3.5" />
                <span>ประวัติซื้อ DCA ({dcaLogs.length})</span>
                {dcaLogsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {monthlyChecklist.items.map((item) => {
                const targetHolding = holdings.find(
                  (h) => h.id === item.holdingId
                );
                if (!targetHolding) return null;

                return (
                  <div
                    key={item.holdingId}
                    className={cn(
                      "flex items-center justify-between gap-2.5 rounded-xl border p-3 text-xs",
                      item.status === "done"
                        ? "border-emerald-600/35 bg-emerald-600/5"
                        : item.status === "partial"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "bg-background"
                    )}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold">{item.symbol}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            item.status === "done"
                              ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300"
                              : item.status === "partial"
                                ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                                : "text-muted-foreground"
                          )}
                        >
                          {item.status === "done"
                            ? "ครบแผนแล้ว"
                            : item.status === "partial"
                              ? `ซื้อแล้ว ฿${formatMoneyDisplay(item.boughtAmountThb)}`
                              : "ยังไม่ซื้อ"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        แผนเดือนนี้ ฿{formatMoneyDisplay(item.plannedAmountThb)}
                        {item.status !== "done" &&
                        toDecimal(item.remainingAmountThb).gt(0)
                          ? ` • เหลือ ฿${formatMoneyDisplay(item.remainingAmountThb)}`
                          : ""}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={item.status === "done" ? "outline" : "default"}
                      disabled={isMutating}
                      onClick={() =>
                        onOpenRecordDca(
                          targetHolding,
                          toDecimal(item.remainingAmountThb).gt(0)
                            ? item.remainingAmountThb
                            : item.plannedAmountThb
                        )
                      }
                      className={cn(
                        "h-8 shrink-0 gap-1 px-2.5 text-xs",
                        item.status !== "done" &&
                          "bg-teal-700 text-white hover:bg-teal-800"
                      )}
                    >
                      <Plus className="h-3 w-3" />
                      <span>
                        {item.status === "done" ? "ซื้อเพิ่ม" : "บันทึกซื้อ"}
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>

            <SmoothExpand watchKey={dcaLogsExpanded ? dcaLogs.length : 0}>
              {dcaLogsExpanded && dcaLogs.length > 0 ? (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    ประวัติการบันทึกซื้อ DCA ล่าสุด
                  </p>
                  <div className="space-y-1.5">
                    {dcaLogs.slice(0, 15).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold">
                              {log.holdingSymbol}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatIsoDateForDisplay(log.executedDate)}
                            </span>
                            {log.transactionId ? (
                              <Badge variant="outline" className="text-[10px]">
                                ผูกโอนบัญชีแล้ว
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                            ฿{formatMoneyDisplay(log.amountThb)}
                            {log.unitsBought
                              ? ` • ${Number(log.unitsBought)} หน่วย`
                              : ""}
                            {log.note ? ` • ${log.note}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isMutating}
                          onClick={() => onDeleteDcaLog(log)}
                          aria-label={`ลบประวัติ DCA ${log.holdingSymbol}`}
                          title="ยกเลิกและปรับยอดคืน"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </SmoothExpand>
          </CardContent>
        </Card>
      ) : null}

      {/* Holdings & Future Real-Tracking Section */}
      <Card>
        <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <span>หุ้น / กองทุนในพอร์ต &amp; ติดตามผลตอบแทนจริง</span>
            </CardTitle>
            <CardDescription>
              ตั้งสัดส่วน DCA รายเดือน กดบันทึกซื้อจริง/ปันผล
              หรืออัปเดตราคาตลาดล่าสุดสำหรับหุ้น/ETF ที่ระบุจำนวนหน่วย
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {isDbMode && holdings.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshingPrices || isMutating}
                onClick={onRefreshPrices}
                className="flex-1 gap-1.5 sm:flex-none"
              >
                {isRefreshingPrices ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-teal-600" />
                )}
                <span>อัปเดตราคาตลาด</span>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={isMutating}
              onClick={onOpenAddHolding}
              className="flex-1 gap-1 bg-teal-700 text-white hover:bg-teal-800 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มหุ้น / กองทุน</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick-Add Popular Presets for Beginners */}
          {POPULAR_DCA_PRESETS.some(
            (p) => !existingSymbolSet.has(p.symbol.toUpperCase())
          ) ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed bg-muted/25 p-3">
              <span className="text-xs text-muted-foreground">
                เพิ่มตัวเลือกยอดนิยมสำหรับมือใหม่ DCA:
              </span>
              {POPULAR_DCA_PRESETS.filter(
                (p) => !existingSymbolSet.has(p.symbol.toUpperCase())
              ).map((preset) => (
                <button
                  key={preset.symbol}
                  type="button"
                  onClick={() => onQuickAddPreset(preset)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-teal-600/50 hover:bg-teal-600/10"
                >
                  <Plus className="h-3 w-3 text-teal-600" />
                  <span>{preset.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">
                    (~{preset.expectedAnnualReturnPct}%)
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {portfolio.holdings.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการหุ้นหรือกองทุน กดปุ่ม &ldquo;+ เพิ่มหุ้น /
              กองทุน&rdquo; หรือเลือกจากตัวเลือกยอดนิยมด้านบนได้เลย
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {portfolio.holdings.map((item) => {
                const assetMeta = INVESTMENT_ASSET_TYPE_META[item.assetType];
                const gainDec = toDecimal(item.unrealizedGain);
                const hasRealData =
                  toDecimal(item.investedCost).gt(0) ||
                  toDecimal(item.currentValue).gt(0) ||
                  toDecimal(item.dividendsReceived).gt(0);

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-bold tracking-tight">
                              {item.symbol}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {assetMeta.shortLabel}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.name}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 max-lg:gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9"
                            aria-label={`แก้ไข ${item.symbol}`}
                            title="แก้ไข / กรอกยอดลงทุนจริง"
                            onClick={() => onOpenEditHolding(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9 text-destructive hover:text-destructive"
                            aria-label={`ลบ ${item.symbol}`}
                            title="ลบออก"
                            onClick={() => onDeleteHolding(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Monthly DCA Plan Split */}
                      <div className="flex items-baseline justify-between border-t pt-2">
                        <div className="text-xs text-muted-foreground tabular-nums">
                          สัดส่วน{" "}
                          <strong className="text-foreground">
                            {item.targetAllocationPct}%
                          </strong>{" "}
                          • คาดหวัง{" "}
                          <strong className="text-emerald-600">
                            {item.expectedAnnualReturnPct}%/ปี
                          </strong>
                        </div>
                        <span className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-300">
                          ฿{formatMoneyDisplay(item.monthlyDcaAmount)}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            /ด.
                          </span>
                        </span>
                      </div>

                      {/* Real Portfolio Tracking Box */}
                      <div className="rounded-lg bg-muted/40 p-2.5 text-xs">
                        {hasRealData ? (
                          <div className="space-y-1 tabular-nums">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                มูลค่าพอร์ตจริง
                              </span>
                              <span className="font-semibold text-foreground">
                                ฿{formatMoneyDisplay(item.currentValue)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                เงินต้นที่ลงไป
                              </span>
                              <span>
                                ฿{formatMoneyDisplay(item.investedCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t pt-1">
                              <span className="text-muted-foreground">
                                กำไร/ขาดทุน
                              </span>
                              <span
                                className={cn(
                                  "font-semibold",
                                  gainDec.gte(0)
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                )}
                              >
                                {gainDec.gte(0) ? "+" : "-"}฿
                                {formatMoneyDisplay(gainDec.abs())} (
                                {gainDec.gte(0) ? "+" : ""}
                                {item.unrealizedGainPct}%)
                              </span>
                            </div>
                            {toDecimal(item.dividendsReceived).gt(0) ? (
                              <div className="flex items-center justify-between gap-2 text-[11px] text-teal-700 dark:text-teal-300">
                                <span>ปันผลรับสะสม</span>
                                <span>
                                  +฿{formatMoneyDisplay(item.dividendsReceived)}
                                </span>
                              </div>
                            ) : null}
                            {item.units && toDecimal(item.units).gt(0) ? (
                              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                <span>จำนวนหน่วยถือครอง</span>
                                <span>
                                  {Number(item.units)} หน่วย (
                                  {item.currency ?? "THB"})
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenRecordDca(item, item.monthlyDcaAmount)
                            }
                            className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <span>
                              ยังไม่เริ่มซื้อจริง — คลิกเพื่อบันทึกซื้อ DCA
                              ไม้แรก
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                          </button>
                        )}
                      </div>

                      {/* Quick DCA & Dividend Action Bar */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutating}
                          onClick={() =>
                            onOpenRecordDca(item, item.monthlyDcaAmount)
                          }
                          className="h-8 gap-1 text-[11px]"
                        >
                          <Plus className="h-3 w-3 text-teal-600" />
                          <span>ซื้อ DCA</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutating}
                          onClick={() => onOpenRecordDividend(item)}
                          className="h-8 gap-1 text-[11px]"
                        >
                          <Coins className="h-3 w-3 text-amber-600" />
                          <span>บันทึกปันผล</span>
                        </Button>
                      </div>
                    </div>

                    {item.broker || item.note ? (
                      <div className="border-t pt-2 text-[11px] text-muted-foreground">
                        {item.broker ? (
                          <span className="font-medium text-foreground">
                            {item.broker}
                          </span>
                        ) : null}
                        {item.broker && item.note ? " • " : ""}
                        {item.note ?? ""}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Portfolio Value Log */}
      <Card>
        <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-teal-600" />
              <span>สมุดบันทึกยอดพอร์ตรายเดือน (สำหรับอัปเดตเองในอนาคต)</span>
            </CardTitle>
            <CardDescription>
              เมื่อเริ่มลงทุนจริง แนะนำบันทึกเดือนละ 1 ครั้งจากหน้าแอปโบรคเกอร์
              เพื่อติดตามเงินต้นเทียบกับมูลค่าจริงและปันผลสะสม
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAddSnapshot}
            className="w-full shrink-0 gap-1.5 sm:w-auto"
          >
            <Plus className="h-4 w-4 text-teal-600" />
            <span>บันทึกยอดพอร์ตเดือนนี้</span>
          </Button>
        </CardHeader>

        <CardContent>
          {sortedSnapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground sm:text-sm">
              ยังไม่มีประวัติการบันทึกยอดพอร์ตรายเดือน — เมื่อเริ่ม DCA
              จริงแล้วสามารถกดปุ่ม{" "}
              <strong className="text-foreground">
                &ldquo;บันทึกยอดพอร์ตเดือนนี้&rdquo;
              </strong>{" "}
              เพื่อจดสรุปผลการลงทุนของแต่ละเดือนได้ทันที
            </div>
          ) : (
            <>
              {/* Mobile & iPad Portrait Cards */}
              <div className="space-y-2.5 lg:hidden">
                {sortedSnapshots.map((snap) => {
                  const cost = toDecimal(snap.investedCost);
                  const val = toDecimal(snap.marketValue);
                  const pnl = val.minus(cost);
                  const pnlPct = cost.gt(0)
                    ? pnl.div(cost).times(100).toDecimalPlaces(2).toNumber()
                    : 0;
                  return (
                    <div
                      key={snap.id}
                      className="rounded-xl border bg-background p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {formatMonthKeyThai(snap.monthKey)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onUseSnapshotAsPrincipal(snap)}
                            className="h-8 gap-1 text-[11px] text-teal-700 dark:text-teal-300"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>ใช้ในจำลอง</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบบันทึกเดือนนี้"
                            className="size-9 text-destructive hover:text-destructive"
                            onClick={() => onDeleteSnapshot(snap.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 tabular-nums">
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            เงินต้นสะสม
                          </p>
                          <p className="font-medium">
                            ฿{formatMoneyDisplay(cost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            มูลค่าจริง
                          </p>
                          <p className="font-semibold">
                            ฿{formatMoneyDisplay(val)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            กำไร/ขาดทุน
                          </p>
                          <p
                            className={cn(
                              "font-semibold",
                              pnl.gte(0) ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {pnl.gte(0) ? "+" : "-"}฿
                            {formatMoneyDisplay(pnl.abs())} ({pnlPct}%)
                          </p>
                        </div>
                      </div>
                      {snap.note ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          หมายเหตุ: {snap.note}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Desktop & iPad Landscape Table */}
              <div className="hidden overflow-hidden rounded-xl border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เดือน</TableHead>
                      <TableHead className="text-right">เงินต้นสะสม</TableHead>
                      <TableHead className="text-right">
                        มูลค่าพอร์ตจริง
                      </TableHead>
                      <TableHead className="text-right">กำไร / ขาดทุน</TableHead>
                      <TableHead className="text-right">ปันผลเดือนนั้น</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead className="w-36 text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSnapshots.map((snap) => {
                      const cost = toDecimal(snap.investedCost);
                      const val = toDecimal(snap.marketValue);
                      const pnl = val.minus(cost);
                      const pnlPct = cost.gt(0)
                        ? pnl.div(cost).times(100).toDecimalPlaces(2).toNumber()
                        : 0;
                      return (
                        <TableRow key={snap.id}>
                          <TableCell className="font-medium">
                            {formatMonthKeyThai(snap.monthKey)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ฿{formatMoneyDisplay(cost)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ฿{formatMoneyDisplay(val)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              pnl.gte(0) ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {pnl.gte(0) ? "+" : "-"}฿
                            {formatMoneyDisplay(pnl.abs())} (
                            {pnl.gte(0) ? "+" : ""}
                            {pnlPct}%)
                          </TableCell>
                          <TableCell className="text-right text-teal-700 tabular-nums dark:text-teal-300">
                            ฿{formatMoneyDisplay(snap.dividends)}
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                            {snap.note ?? "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-teal-700 dark:text-teal-300"
                                onClick={() => onUseSnapshotAsPrincipal(snap)}
                              >
                                ใช้ในจำลอง
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="ลบบันทึกเดือนนี้"
                                className="text-destructive hover:text-destructive"
                                onClick={() => onDeleteSnapshot(snap.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
