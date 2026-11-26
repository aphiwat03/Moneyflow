"use client";

import { useState } from "react";
import { Banknote, TrendingUp } from "lucide-react";
import type {
  RecordSalaryReceiptInput,
  SalaryAllocationFormInput,
} from "@/actions/salary-plan";
import { Button } from "@/components/ui/button";
import { AppDatePicker } from "@/components/ui/date-picker";
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
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import { computeWishlistMonthlyAmount } from "@/lib/salary-plan";
import type {
  ActionResult,
  ComputedAllocationItem,
  PlanAllocationMode,
  PlanBucketType,
  SalaryPlanSummary,
  WalletDTO,
} from "@/lib/types";

interface PlanAllocationFormBodyProps {
  summary: SalaryPlanSummary;
  activeWallets: WalletDTO[];
  editingAlloc: ComputedAllocationItem | null;
  defaultBucket: PlanBucketType;
  onClose: () => void;
  onSaveAllocation: (
    input: SalaryAllocationFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
}

function getDefaultAllocationName(bucket: PlanBucketType): string {
  if (bucket === "cold_money") return "เงินเย็นสำรองฉุกเฉิน";
  if (bucket === "dca") return "ลงทุน DCA รายเดือน";
  return "";
}

function PlanAllocationFormBody({
  summary,
  activeWallets,
  editingAlloc,
  defaultBucket,
  onClose,
  onSaveAllocation,
}: PlanAllocationFormBodyProps) {
  const [allocName, setAllocName] = useState(
    editingAlloc ? editingAlloc.name : getDefaultAllocationName(defaultBucket)
  );
  const [allocBucket, setAllocBucket] = useState<PlanBucketType>(
    editingAlloc ? editingAlloc.bucketType : defaultBucket
  );
  const [allocMode, setAllocMode] = useState<PlanAllocationMode>(
    editingAlloc ? editingAlloc.mode : "fixed"
  );
  const [allocValue, setAllocValue] = useState(
    editingAlloc ? editingAlloc.value : ""
  );
  const [allocTargetTotal, setAllocTargetTotal] = useState(
    editingAlloc?.targetTotal ?? ""
  );
  const [allocTargetMonths, setAllocTargetMonths] = useState(
    editingAlloc?.targetMonths ? String(editingAlloc.targetMonths) : ""
  );
  const [allocLinkedWalletId, setAllocLinkedWalletId] = useState(
    editingAlloc?.linkedWalletId ?? ""
  );
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSaving, setAllocSaving] = useState(false);

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
        const computed = computeWishlistMonthlyAmount(
          nextTotal.trim(),
          monthsNum
        );
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
      onClose();
    } finally {
      setAllocSaving(false);
    }
  }

  return (
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
                  handleWishlistCalcChange(e.target.value, allocTargetMonths)
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
                  handleWishlistCalcChange(allocTargetTotal, e.target.value)
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
            <p className="text-[11px] text-teal-700 tabular-nums dark:text-teal-300">
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
          <Label htmlFor="alloc-wallet">ผูกกระเป๋าปลายทาง (ติดตามยอดโอน)</Label>
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
          disabled={allocSaving}
          onClick={onClose}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          loading={allocSaving}
          loadingText="กำลังบันทึก..."
        >
          บันทึกเป้าหมาย
        </Button>
      </DialogFooter>
    </form>
  );
}

interface PlanAllocationDialogProps {
  open: boolean;
  formKey: number;
  summary: SalaryPlanSummary;
  activeWallets: WalletDTO[];
  editingAlloc: ComputedAllocationItem | null;
  defaultBucket: PlanBucketType;
  onOpenChange: (open: boolean) => void;
  onSaveAllocation: (
    input: SalaryAllocationFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
}

export function PlanAllocationDialog({
  open,
  formKey,
  summary,
  activeWallets,
  editingAlloc,
  defaultBucket,
  onOpenChange,
  onSaveAllocation,
}: PlanAllocationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingAlloc
              ? "แก้ไขก้อนเงินออม / เป้าหมาย"
              : "เพิ่มก้อนเงินออม / เป้าหมาย"}
          </DialogTitle>
          <DialogDescription>
            แบ่งส่วนจากเงินเดือนเป็น เงินเย็น ลงทุน DCA หรือเก็บซื้อของที่อยากได้
          </DialogDescription>
        </DialogHeader>

        <PlanAllocationFormBody
          key={formKey}
          summary={summary}
          activeWallets={activeWallets}
          editingAlloc={editingAlloc}
          defaultBucket={defaultBucket}
          onClose={() => onOpenChange(false)}
          onSaveAllocation={onSaveAllocation}
        />
      </DialogContent>
    </Dialog>
  );
}

interface PlanReceiveSalaryFormBodyProps {
  summary: SalaryPlanSummary;
  onClose: () => void;
  onRecordSalaryReceipt: (
    input: RecordSalaryReceiptInput
  ) => Promise<ActionResult<unknown>>;
}

function PlanReceiveSalaryFormBody({
  summary,
  onClose,
  onRecordSalaryReceipt,
}: PlanReceiveSalaryFormBodyProps) {
  const [amount, setAmount] = useState(
    toDecimal(summary.monthlySalary).gt(0) ? summary.monthlySalary : ""
  );
  const [transactionDate, setTransactionDate] = useState(summary.todayDate);
  const [note, setNote] = useState("รับเงินเดือน");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await onRecordSalaryReceipt({
        amount: amount.trim(),
        transactionDate,
        note: note.trim() || "รับเงินเดือน",
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setError(firstErr ?? res.error ?? "บันทึกรับเงินเดือนไม่สำเร็จ");
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs">
        <span className="text-muted-foreground">เข้ากระเป๋า: </span>
        <strong className="text-foreground">{summary.salaryWalletName}</strong>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="receive-salary-amount">จำนวนเงินที่เข้าจริง (บาท)</Label>
          <Input
            id="receive-salary-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="เช่น 14500"
            className="h-10"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="receive-salary-date">วันที่เงินเข้า</Label>
          <AppDatePicker
            id="receive-salary-date"
            value={transactionDate}
            onChange={setTransactionDate}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receive-salary-note">หมายเหตุ</Label>
        <Input
          id="receive-salary-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="รับเงินเดือน"
          className="h-10"
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onClose}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          loading={saving}
          loadingText="กำลังบันทึก..."
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          ยืนยันรับเงินเข้ากระเป๋า
        </Button>
      </DialogFooter>
    </form>
  );
}

interface PlanReceiveSalaryDialogProps {
  open: boolean;
  formKey: number;
  summary: SalaryPlanSummary;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onRecordSalaryReceipt: (
    input: RecordSalaryReceiptInput
  ) => Promise<ActionResult<unknown>>;
}

export function PlanReceiveSalaryDialog({
  open,
  formKey,
  summary,
  monthLabel,
  onOpenChange,
  onOpenSettings,
  onRecordSalaryReceipt,
}: PlanReceiveSalaryDialogProps) {
  const hasSalaryWallet = Boolean(summary.salaryWalletId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-600" />
            <span>บันทึกเงินเดือนเข้าจริง ({monthLabel})</span>
          </DialogTitle>
          <DialogDescription>
            {hasSalaryWallet
              ? "สร้างรายการรายรับจริงเข้ากระเป๋าหลัก เมื่อเงินเดือนเข้าแล้วในรอบนี้"
              : "กรุณาเลือกกระเป๋ารับเงินในเมนูตั้งค่ารายได้ก่อนกดรับเงินเดือน"}
          </DialogDescription>
        </DialogHeader>

        {hasSalaryWallet ? (
          <PlanReceiveSalaryFormBody
            key={formKey}
            summary={summary}
            onClose={() => onOpenChange(false)}
            onRecordSalaryReceipt={onRecordSalaryReceipt}
          />
        ) : (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ปิด
            </Button>
            <Button
              type="button"
              onClick={onOpenSettings}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              เลือกกระเป๋ารับเงิน
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PlanTransferConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SalaryPlanSummary;
  monthLabel: string;
  pendingAllocations: ComputedAllocationItem[];
  transferring: boolean;
  onOpenSettings?: () => void;
  onConfirm: () => Promise<void>;
}

export function PlanTransferConfirmDialog({
  open,
  onOpenChange,
  summary,
  monthLabel,
  pendingAllocations,
  transferring,
  onOpenSettings,
  onConfirm,
}: PlanTransferConfirmDialogProps) {
  const hasSalaryWallet = Boolean(summary.salaryWalletId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ยืนยันการโอนเงินตามแผน ({monthLabel})</DialogTitle>
          <DialogDescription>
            {hasSalaryWallet ? (
              <>
                ระบบจะสร้างรายการโอนย้าย (Transfer) จาก{" "}
                <strong>{summary.salaryWalletName}</strong>{" "}
                ไปยังกระเป๋าเป้าหมายต่อไปนี้:
              </>
            ) : (
              "กรุณาเลือกกระเป๋ารับเงินเดือนในเมนูตั้งค่ารายได้ก่อนทำการโอนตามแผน"
            )}
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
            disabled={transferring}
            onClick={() => onOpenChange(false)}
          >
            ยกเลิก
          </Button>
          {hasSalaryWallet ? (
            <Button
              type="button"
              loading={transferring}
              loadingText="กำลังดำเนินการ..."
              onClick={onConfirm}
              className="bg-sky-600 text-white hover:bg-sky-700"
            >
              ยืนยันโอนตามแผน
            </Button>
          ) : onOpenSettings ? (
            <Button
              type="button"
              onClick={onOpenSettings}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              ตั้งค่ากระเป๋ารับเงิน
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
