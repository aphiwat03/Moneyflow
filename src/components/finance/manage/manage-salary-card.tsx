"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
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
import { toDecimal } from "@/lib/decimal";
import type { ActionResult, SalarySettingsDTO, WalletDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ManageNotice } from "./manage-wallets-section";

interface ManageSalaryCardProps {
  wallets: WalletDTO[];
  salarySettings?: SalarySettingsDTO | null;
  onSaveSalarySettings: (
    input: SalarySettingsFormInput
  ) => Promise<ActionResult<unknown>>;
  onNotify: (notice: ManageNotice | null) => void;
}

export function ManageSalaryCard({
  wallets,
  salarySettings,
  onSaveSalarySettings,
  onNotify,
}: ManageSalaryCardProps) {
  const activeWallets = wallets.filter((w) => !w.isArchived);
  const [manageSalaryInput, setManageSalaryInput] = useState(
    salarySettings && toDecimal(salarySettings.monthlySalary).gt(0)
      ? salarySettings.monthlySalary
      : ""
  );
  const [manageExtraIncomeInput, setManageExtraIncomeInput] = useState(
    salarySettings && toDecimal(salarySettings.extraIncome ?? "0").gt(0)
      ? (salarySettings.extraIncome ?? "")
      : ""
  );
  const [managePaydayInput, setManagePaydayInput] = useState(
    String(salarySettings?.payday ?? 1)
  );
  const [manageSalaryWalletId, setManageSalaryWalletId] = useState(
    salarySettings?.salaryWalletId ?? ""
  );
  const [manageSalarySaving, setManageSalarySaving] = useState(false);

  async function handleSalarySettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManageSalarySaving(true);
    onNotify(null);
    try {
      const res = await onSaveSalarySettings({
        monthlySalary: manageSalaryInput.trim() || "0",
        extraIncome: manageExtraIncomeInput.trim() || "0",
        payday: Number(managePaydayInput) || 1,
        salaryWalletId: manageSalaryWalletId || null,
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        onNotify({
          type: "error",
          message: firstErr ?? res.error ?? "บันทึกการตั้งค่าเงินเดือนไม่สำเร็จ",
        });
      } else {
        onNotify({
          type: "success",
          message: `บันทึกเงินเดือนและวันเงินออก (ทุกวันที่ ${Number(managePaydayInput) || 1}) เรียบร้อยแล้ว`,
        });
      }
    } finally {
      setManageSalarySaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-teal-600" />
          <span>ตั้งค่าเงินเดือน &amp; วันที่เงินเดือนออก</span>
        </CardTitle>
        <CardDescription>
          กำหนดฐานเงินเดือนคงที่และวันที่เงินเข้า (เช่น ทุกวันที่ 1, 15, 25 หรือสิ้นเดือน)
          เพื่อใช้คำนวณรอบเดือนในหน้าแผนเงินเดือน
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSalarySettingsSubmit} className="space-y-4">
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
              const active = Number(managePaydayInput) === preset.day;
              return (
                <button
                  key={preset.day}
                  type="button"
                  onClick={() => setManagePaydayInput(String(preset.day))}
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
              <Label htmlFor="manage-salary">เงินเดือนคงที่ (บาท/เดือน)</Label>
              <Input
                id="manage-salary"
                inputMode="decimal"
                placeholder="0 (ถ้ายังไม่เริ่มงาน)"
                value={manageSalaryInput}
                onChange={(e) => setManageSalaryInput(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manage-extra-income">
                รายได้เสริม / Part-time (บาท)
              </Label>
              <Input
                id="manage-extra-income"
                inputMode="decimal"
                placeholder="เช่น 2500"
                value={manageExtraIncomeInput}
                onChange={(e) => setManageExtraIncomeInput(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manage-payday">วันที่เงินเดือนออก (1–31)</Label>
              <AppSelect
                id="manage-payday"
                value={managePaydayInput}
                onValueChange={setManagePaydayInput}
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
              <Label htmlFor="manage-salary-wallet">
                กระเป๋ารับเงิน (ไม่บังคับ)
              </Label>
              <AppSelect
                id="manage-salary-wallet"
                value={manageSalaryWalletId}
                onValueChange={setManageSalaryWalletId}
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

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={manageSalarySaving}
              className="h-10 bg-teal-700 px-6 text-white hover:bg-teal-800 md:h-9"
            >
              {manageSalarySaving ? "กำลังบันทึก..." : "บันทึกวันเงินออก & รายได้"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
