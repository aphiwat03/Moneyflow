"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import type { SalarySettingsFormInput } from "@/actions/salary-plan";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/components/ui/toast";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import { extractTaxAlertFromResult } from "@/lib/thai-tax";
import type { ActionResult, SalaryPlanSummary, WalletDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlanSettingsDialogProps {
  open: boolean;
  formKey: number;
  summary: SalaryPlanSummary;
  activeWallets: WalletDTO[];
  salaryInput: string;
  extraIncomeInput: string;
  draftTotalIncome: string;
  onOpenChange: (open: boolean) => void;
  onSalaryInputChange: (value: string) => void;
  onExtraIncomeInputChange: (value: string) => void;
  onSaveSettings: (
    input: SalarySettingsFormInput
  ) => Promise<ActionResult<unknown>>;
  onNotice: (
    notice: { type: "error" | "success"; message: string } | null
  ) => void;
}

interface PlanSettingsFormBodyProps {
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
  onClose: () => void;
}

function PlanSettingsFormBody({
  summary,
  activeWallets,
  salaryInput,
  extraIncomeInput,
  draftTotalIncome,
  onSalaryInputChange,
  onExtraIncomeInputChange,
  onSaveSettings,
  onNotice,
  onClose,
}: PlanSettingsFormBodyProps) {
  const [paydayInput, setPaydayInput] = useState(String(summary.payday));
  const [salaryWalletId, setSalaryWalletId] = useState(
    summary.salaryWalletId ?? activeWallets[0]?.id ?? ""
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
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
        setFormError(firstErr ?? res.error ?? "บันทึกข้อมูลรายได้ไม่สำเร็จ");
        return;
      }
      onClose();
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
    <form onSubmit={handleSettingsSubmit} className="space-y-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {formError}
        </p>
      ) : null}

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

      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="flex flex-col justify-end space-y-1.5">
          <Label htmlFor="salary-monthly">เงินเดือนคงที่ (บาท/เดือน)</Label>
          <Input
            id="salary-monthly"
            inputMode="decimal"
            placeholder="0 (ถ้ายังไม่เริ่มงาน)"
            value={salaryInput}
            onChange={(e) => onSalaryInputChange(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="flex flex-col justify-end space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="salary-extra" className="whitespace-nowrap">
              รายได้เสริม (บาท)
            </Label>
            {toDecimal(summary.periodIncome).gt(0) ? (
              <button
                type="button"
                onClick={() => onExtraIncomeInputChange(summary.periodIncome)}
                className="shrink-0 whitespace-nowrap text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
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

        <div className="flex flex-col justify-end space-y-1.5">
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

        <div className="flex flex-col justify-end space-y-1.5">
          <Label htmlFor="salary-wallet">กระเป๋ารับเงิน (ไม่บังคับ)</Label>
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

      <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        ยอดรวมที่ใช้คำนวณแผน:{" "}
        <strong className="text-foreground tabular-nums">
          ฿{formatMoneyDisplay(draftTotalIncome)}
        </strong>{" "}
        (ยังไม่ต้องมีเงินเดือนคงที่ก็ใส่เฉพาะช่องรายได้เสริมได้)
      </p>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={settingsSaving}
          onClick={onClose}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          loading={settingsSaving}
          loadingText="กำลังบันทึก..."
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          บันทึกการตั้งค่า
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PlanSettingsDialog({
  open,
  formKey,
  summary,
  activeWallets,
  salaryInput,
  extraIncomeInput,
  draftTotalIncome,
  onOpenChange,
  onSalaryInputChange,
  onExtraIncomeInputChange,
  onSaveSettings,
  onNotice,
}: PlanSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-teal-600" />
            <span>เงินเดือนคงที่ &amp; รายได้เสริม (Part-time / ฟรีแลนซ์)</span>
          </DialogTitle>
          <DialogDescription>
            กรอกเงินเดือนคงที่ หรือใส่เฉพาะรายได้เสริมและวันเงินออก
            เพื่อให้ระบบคำนวณส่วนแบ่งและงบรายวันให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <PlanSettingsFormBody
          key={formKey}
          summary={summary}
          activeWallets={activeWallets}
          salaryInput={salaryInput}
          extraIncomeInput={extraIncomeInput}
          draftTotalIncome={draftTotalIncome}
          onSalaryInputChange={onSalaryInputChange}
          onExtraIncomeInputChange={onExtraIncomeInputChange}
          onSaveSettings={onSaveSettings}
          onNotice={onNotice}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
