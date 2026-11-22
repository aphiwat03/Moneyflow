"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Wallet } from "lucide-react";
import type { SalarySettingsFormInput } from "@/actions/salary-plan";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { SmoothExpand } from "@/components/ui/smooth-expand";
import { toast } from "@/components/ui/toast";
import { formatIsoDateForDisplay } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import { extractTaxAlertFromResult } from "@/lib/thai-tax";
import type { ActionResult, SalaryPlanSummary, WalletDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlanSettingsCardProps {
  summary: SalaryPlanSummary;
  activeWallets: WalletDTO[];
  salaryInput: string;
  extraIncomeInput: string;
  draftTotalIncome: string;
  onSalaryInputChange: (value: string) => void;
  onExtraIncomeInputChange: (value: string) => void;
  onSaveSettings: (
    input: SalarySettingsFormInput
  ) => Promise<ActionResult<unknown>>;
  onNotice: (
    notice: { type: "error" | "success"; message: string } | null
  ) => void;
}

export function PlanSettingsCard({
  summary,
  activeWallets,
  salaryInput,
  extraIncomeInput,
  draftTotalIncome,
  onSalaryInputChange,
  onExtraIncomeInputChange,
  onSaveSettings,
  onNotice,
}: PlanSettingsCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(!summary.hasSalaryConfigured);
  const [paydayInput, setPaydayInput] = useState(String(summary.payday));
  const [salaryWalletId, setSalaryWalletId] = useState(
    summary.salaryWalletId ?? activeWallets[0]?.id ?? ""
  );
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function handleSettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNotice(null);
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
        onNotice({
          type: "error",
          message: firstErr ?? res.error ?? "บันทึกข้อมูลรายได้ไม่สำเร็จ",
        });
        return;
      }
      setSettingsOpen(false);
      onNotice({
        type: "success",
        message: "บันทึกรายได้ เงินเดือนคงที่ และวันเงินออกเรียบร้อยแล้ว",
      });
      const taxAlert = extractTaxAlertFromResult(res.data);
      if (taxAlert) {
        toast[taxAlert.kind](taxAlert.title, taxAlert.detail);
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
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
                <strong className="text-foreground">{summary.payday}</strong> •
                รอบคำนวณ{" "}
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
                    onChange={(e) => onSalaryInputChange(e.target.value)}
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
                        onClick={() =>
                          onExtraIncomeInputChange(summary.periodIncome)
                        }
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
                    onChange={(e) => onExtraIncomeInputChange(e.target.value)}
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
                  loading={settingsSaving}
                  loadingText="กำลังบันทึก..."
                  className="h-10 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  บันทึกการตั้งค่า
                </Button>
              </div>
            </form>
          </CardContent>
        ) : null}
      </SmoothExpand>
    </Card>
  );
}
