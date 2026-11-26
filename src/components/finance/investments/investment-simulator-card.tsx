"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  LineChart,
  PieChart as PieChartIcon,
  Sparkles,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import type {
  InvestmentPlanSettingsDTO,
  InvestmentPortfolioSummary,
  InvestmentProjectionSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const InvestmentProjectionChart = dynamic(
  () =>
    import("../investment-charts").then((m) => m.InvestmentProjectionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg bg-muted sm:h-72" />
    ),
  }
);

const InvestmentAllocationDonutChart = dynamic(
  () =>
    import("../investment-charts").then(
      (m) => m.InvestmentAllocationDonutChart
    ),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
  }
);

const GOAL_PRESETS = [
  { label: "5 แสน", value: "500000" },
  { label: "1 ล้าน", value: "1000000" },
  { label: "2 ล้าน", value: "2000000" },
  { label: "5 ล้าน", value: "5000000" },
  { label: "10 ล้าน", value: "10000000" },
];

const RETURN_PRESETS = [
  { label: "5% เสี่ยงต่ำ", value: 5 },
  { label: "8% S&P 500 เฉลี่ย", value: 8 },
  { label: "10% เติบโตสูง", value: 10 },
];

const HORIZON_PRESETS = [5, 10, 15, 20, 30];

interface InvestmentSimulatorCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDbMode: boolean;
  settingsSaveState: "idle" | "saving" | "saved";
  settings: InvestmentPlanSettingsDTO;
  portfolio: InvestmentPortfolioSummary;
  projection: InvestmentProjectionSummary;
  holdingsCount: number;
  currentGregorianYear: number;
  linkedInvestmentWalletTotal: string;
  linkedPlanDcaMonthly: string;
  displayedPortfolioValue: string;
  goalInput: string;
  principalInput: string;
  monthlyDcaInput: string;
  returnInput: string;
  horizonInput: string;
  stepUpInput: string;
  onGoalChange: (val: string) => void;
  onPrincipalChange: (val: string) => void;
  onMonthlyDcaChange: (val: string) => void;
  onReturnChange: (val: string) => void;
  onHorizonChange: (val: string) => void;
  onStepUpChange: (val: string) => void;
}

export function InvestmentSimulatorCard({
  open,
  onOpenChange,
  isDbMode,
  settingsSaveState,
  settings,
  portfolio,
  projection,
  holdingsCount,
  currentGregorianYear,
  linkedInvestmentWalletTotal,
  linkedPlanDcaMonthly,
  displayedPortfolioValue,
  goalInput,
  principalInput,
  monthlyDcaInput,
  returnInput,
  horizonInput,
  stepUpInput,
  onGoalChange,
  onPrincipalChange,
  onMonthlyDcaChange,
  onReturnChange,
  onHorizonChange,
  onStepUpChange,
}: InvestmentSimulatorCardProps) {
  const currentMonthlyDcaDec = toDecimal(settings.monthlyDca);
  const requiredDcaDec = toDecimal(projection.requiredMonthlyDcaForHorizon);
  const dcaShortfallDec = requiredDcaDec.minus(currentMonthlyDcaDec);

  return (
    <>
      {/* Simulator Dashboard Dialog (on-demand via header button) */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 pr-6">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <span>ตัวจำลองแผนการลงทุน &amp; เป้าหมายพอร์ตระยะยาว</span>
              </DialogTitle>
              {isDbMode && settingsSaveState !== "idle" ? (
                <Badge
                  variant="outline"
                  className="text-[11px] font-normal text-muted-foreground"
                >
                  {settingsSaveState === "saving"
                    ? "กำลังบันทึก..."
                    : "บันทึกอัตโนมัติแล้ว"}
                </Badge>
              ) : null}
            </div>
            <DialogDescription>
              ปรับตัวเลขเป้าหมาย ยอด DCA
              และผลตอบแทนเฉลี่ยเพื่อดูกราฟทบต้นแบบเรียลไทม์
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quick Preset Chips */}
            <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  เป้าหมายด่วน:
                </span>
                {GOAL_PRESETS.map((preset) => {
                  const active = toDecimal(settings.targetGoalAmount).eq(
                    preset.value
                  );
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onGoalChange(preset.value)}
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

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  ผลตอบแทนเฉลี่ย:
                </span>
                {RETURN_PRESETS.map((preset) => {
                  const active =
                    settings.expectedAnnualReturnPct === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onReturnChange(String(preset.value))}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                {holdingsCount > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      onReturnChange(
                        String(portfolio.weightedExpectedReturnPct)
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      settings.expectedAnnualReturnPct ===
                        portfolio.weightedExpectedReturnPct
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-teal-600/30 bg-teal-600/10 text-teal-700 hover:bg-teal-600/15 dark:text-teal-300"
                    )}
                  >
                    ใช้เฉลี่ยจากพอร์ต ({portfolio.weightedExpectedReturnPct}%)
                  </button>
                ) : null}
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-3">
              <div className="flex h-full flex-col justify-end space-y-1.5">
                <Label htmlFor="inv-goal">เป้าหมายพอร์ต (บาท)</Label>
                <Input
                  id="inv-goal"
                  inputMode="decimal"
                  value={goalInput}
                  onChange={(e) => onGoalChange(e.target.value)}
                  placeholder="2000000"
                />
              </div>

              <div className="flex h-full flex-col justify-end space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <Label htmlFor="inv-principal">
                    เงินต้นตั้งต้น / พอร์ตปัจจุบัน (บาท)
                  </Label>
                  {toDecimal(linkedInvestmentWalletTotal).gt(0) ? (
                    <button
                      type="button"
                      onClick={() =>
                        onPrincipalChange(linkedInvestmentWalletTotal)
                      }
                      className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                    >
                      ดึงจากกระเป๋าหุ้น (฿
                      {formatMoneyDisplay(linkedInvestmentWalletTotal)})
                    </button>
                  ) : portfolio.hasRealTrackingData ? (
                    <button
                      type="button"
                      onClick={() =>
                        onPrincipalChange(portfolio.totalCurrentValue)
                      }
                      className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                    >
                      ใช้ยอดพอร์ตจริง (฿
                      {formatMoneyDisplay(portfolio.totalCurrentValue)})
                    </button>
                  ) : null}
                </div>
                <Input
                  id="inv-principal"
                  inputMode="decimal"
                  value={principalInput}
                  onChange={(e) => onPrincipalChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="flex h-full flex-col justify-end space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <Label htmlFor="inv-dca">ยอด DCA ต่อเดือน (บาท)</Label>
                  {toDecimal(linkedPlanDcaMonthly).gt(0) ? (
                    <button
                      type="button"
                      onClick={() => onMonthlyDcaChange(linkedPlanDcaMonthly)}
                      className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                    >
                      ดึงจากแผนเงินเดือน (฿
                      {formatMoneyDisplay(linkedPlanDcaMonthly)})
                    </button>
                  ) : null}
                </div>
                <Input
                  id="inv-dca"
                  inputMode="decimal"
                  value={monthlyDcaInput}
                  onChange={(e) => onMonthlyDcaChange(e.target.value)}
                  placeholder="3000"
                />
              </div>

              <div className="flex h-full flex-col justify-end space-y-1.5">
                <Label htmlFor="inv-return">
                  ผลตอบแทนเฉลี่ยคาดหวัง (% ต่อปี)
                </Label>
                <Input
                  id="inv-return"
                  inputMode="decimal"
                  value={returnInput}
                  onChange={(e) => onReturnChange(e.target.value)}
                  placeholder="8"
                />
              </div>

              <div className="flex h-full flex-col justify-end space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="inv-horizon" className="whitespace-nowrap">ระยะเวลา (ปี)</Label>
                  <div className="flex items-center gap-1">
                    {HORIZON_PRESETS.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => onHorizonChange(String(yr))}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                          settings.horizonYears === yr
                            ? "bg-teal-700 text-white"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {yr}ปี
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  id="inv-horizon"
                  inputMode="numeric"
                  value={horizonInput}
                  onChange={(e) => onHorizonChange(e.target.value)}
                  placeholder="15"
                />
              </div>

              <div className="flex h-full flex-col justify-end space-y-1.5">
                <Label htmlFor="inv-stepup">
                  เพิ่มยอด DCA ต่อปี (% — เมื่อเงินเดือนขึ้น)
                </Label>
                <Input
                  id="inv-stepup"
                  inputMode="decimal"
                  value={stepUpInput}
                  onChange={(e) => onStepUpChange(e.target.value)}
                  placeholder="0 (เช่น 5 หรือ 10)"
                />
              </div>
            </div>

            {/* Insight Box */}
            <div className="grid gap-3 rounded-xl border bg-muted/30 p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">
                  มูลค่าพอร์ตเมื่อครบ {settings.horizonYears} ปี (พ.ศ.{" "}
                  {currentGregorianYear + 543 + settings.horizonYears})
                </p>
                <p className="text-base font-bold text-emerald-600 tabular-nums">
                  ฿{formatMoneyDisplay(projection.finalValue)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  เงินต้นสะสม ฿{formatMoneyDisplay(projection.finalContributed)}{" "}
                  + ผลตอบแทนทบต้น{" "}
                  <strong className="text-emerald-600">
                    +฿{formatMoneyDisplay(projection.finalGain)} (+
                    {projection.finalGainPct}%)
                  </strong>
                </p>
              </div>

              <div className="space-y-0.5">
                <p className="text-muted-foreground">
                  ถ้าอยากถึงเป้า ฿
                  {formatMoneyDisplay(settings.targetGoalAmount)} ใน{" "}
                  {settings.horizonYears} ปี
                </p>
                <p className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-300">
                  ต้อง DCA ~฿
                  {formatMoneyDisplay(projection.requiredMonthlyDcaForHorizon)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / เดือน
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {dcaShortfallDec.gt(0)
                    ? `ยังขาดอีก ฿${formatMoneyDisplay(dcaShortfallDec)}/ด. จากแผนตอนนี้`
                    : "ยอด DCA ตอนนี้เพียงพอถึงเป้าภายในระยะเวลาที่ตั้งไว้แล้ว ✓"}
                </p>
              </div>

              <div className="flex flex-col justify-between gap-2 sm:col-span-2 lg:col-span-1">
                <p className="text-muted-foreground">
                  ความคืบหน้าสู่เป้า ฿
                  {formatMoneyDisplay(settings.targetGoalAmount)}
                </p>
                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="animate-mf-progress h-full rounded-full bg-teal-600"
                      style={{ width: `${projection.goalProgressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="text-muted-foreground">
                      พอร์ตปัจจุบัน ฿
                      {formatMoneyDisplay(displayedPortfolioValue)}
                    </span>
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      {projection.goalProgressPct}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Chart Preview inside Simulator Dashboard */}
            <div className="rounded-xl border bg-background p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <LineChart className="h-3.5 w-3.5 text-emerald-600" />
                <span>
                  กราฟคาดการณ์ทบต้น ({settings.horizonYears} ปี • เฉลี่ย{" "}
                  {settings.expectedAnnualReturnPct}%/ปี)
                </span>
              </p>
              <InvestmentProjectionChart
                points={projection.points}
                targetGoal={Number(settings.targetGoalAmount)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              เสร็จสิ้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Charts Row on Main Page */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-emerald-600" />
              <span>
                จำลองการเติบโตแบบทบต้น ({settings.horizonYears} ปี • เฉลี่ย{" "}
                {settings.expectedAnnualReturnPct}%/ปี)
              </span>
            </CardTitle>
            <CardDescription>
              เปรียบเทียบเงินต้นที่ใส่สะสม (สีฟ้า)
              กับมูลค่าพอร์ตเมื่อรวมผลตอบแทนทบต้น (สีเขียว)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvestmentProjectionChart
              points={projection.points}
              targetGoal={Number(settings.targetGoalAmount)}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-4 w-4 text-teal-600" />
              <span>สัดส่วนแผน DCA แยกรายสินทรัพย์</span>
            </CardTitle>
            <CardDescription>
              แบ่งยอด ฿{formatMoneyDisplay(settings.monthlyDca)}/เดือน
              ตามสัดส่วนที่ตั้งใจลงทุน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {holdingsCount > 0 &&
            Math.abs(portfolio.totalTargetAllocationPct - 100) > 0.1 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  สัดส่วนเป้าหมายรวมตอนนี้คือ{" "}
                  <strong>{portfolio.totalTargetAllocationPct}%</strong>{" "}
                  (แนะนำปรับให้รวมกันเท่ากับ 100%)
                </span>
              </div>
            ) : null}

            <InvestmentAllocationDonutChart
              holdings={portfolio.holdings}
              monthlyDca={settings.monthlyDca}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
