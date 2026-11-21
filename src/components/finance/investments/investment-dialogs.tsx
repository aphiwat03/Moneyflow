"use client";

import { useState } from "react";
import type {
  InvestmentHoldingFormInput,
  InvestmentSnapshotFormInput,
  RecordDcaExecutionInput,
  RecordDividendInput,
} from "@/actions/investments";
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
import { AppDatePicker, AppMonthPicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { toDecimal } from "@/lib/decimal";
import type {
  CategoryDTO,
  InvestmentAssetType,
  InvestmentCurrency,
  InvestmentHoldingDTO,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const HOLDING_COLOR_PRESETS = [
  "#0f766e",
  "#10b981",
  "#3b82f6",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#f97316",
  "#ec4899",
  "#64748b",
];

export function parseSafeNonNegative(raw: string, fallback = "0.00"): string {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return fallback;
  try {
    const d = toDecimal(cleaned);
    if (d.isNegative() || !d.isFinite()) return fallback;
    return d.toFixed(2);
  } catch {
    return fallback;
  }
}

export function formatMonthKeyThai(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const thaiMonthsShort = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const y = Number(match[1]) + 543;
  const m = Number(match[2]);
  return `${thaiMonthsShort[m - 1] ?? match[2]} ${y}`;
}

/* ============================================================================
 * 1. Add / Edit Holding Dialog
 * ============================================================================ */

interface HoldingFormBodyProps {
  editingHolding: InvestmentHoldingDTO | null;
  defaultTargetPct: string;
  defaultColor: string;
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (
    payload: InvestmentHoldingFormInput,
    editingId?: string
  ) => Promise<string | null>;
}

function HoldingFormBody({
  editingHolding,
  defaultTargetPct,
  defaultColor,
  isMutating,
  onClose,
  onSubmit,
}: HoldingFormBodyProps) {
  const [hSymbol, setHSymbol] = useState(editingHolding?.symbol ?? "");
  const [hName, setHName] = useState(editingHolding?.name ?? "");
  const [hAssetType, setHAssetType] = useState<InvestmentAssetType>(
    editingHolding?.assetType ?? "etf"
  );
  const [hTargetPct, setHTargetPct] = useState(
    editingHolding
      ? String(editingHolding.targetAllocationPct)
      : defaultTargetPct
  );
  const [hExpectedReturn, setHExpectedReturn] = useState(
    editingHolding ? String(editingHolding.expectedAnnualReturnPct) : "8"
  );
  const [hInvestedCost, setHInvestedCost] = useState(
    editingHolding?.investedCost ?? "0.00"
  );
  const [hCurrentValue, setHCurrentValue] = useState(
    editingHolding?.currentValue ?? "0.00"
  );
  const [hDividends, setHDividends] = useState(
    editingHolding?.dividendsReceived ?? "0.00"
  );
  const [hUnits, setHUnits] = useState(
    editingHolding?.units ? String(Number(editingHolding.units)) : ""
  );
  const [hCurrency, setHCurrency] = useState<InvestmentCurrency>(
    editingHolding?.currency ?? "THB"
  );
  const [hBroker, setHBroker] = useState(editingHolding?.broker ?? "");
  const [hNote, setHNote] = useState(editingHolding?.note ?? "");
  const [hColor, setHColor] = useState(editingHolding?.color ?? defaultColor);
  const [hError, setHError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHError(null);

    const symbol = hSymbol.trim().toUpperCase();
    const name = hName.trim();
    if (!symbol) {
      setHError("กรุณากรอกชื่อย่อหุ้นหรือกองทุน เช่น VOO, SCHD, SCBS&P500");
      return;
    }
    if (!name) {
      setHError("กรุณากรอกชื่อเต็มหรือคำอธิบายสินทรัพย์");
      return;
    }

    const targetPct = Number(hTargetPct);
    if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 100) {
      setHError("สัดส่วนเป้าหมายต้องอยู่ระหว่าง 0 ถึง 100%");
      return;
    }

    const expectedRet = Number(hExpectedReturn);
    if (!Number.isFinite(expectedRet) || expectedRet < 0 || expectedRet > 50) {
      setHError("ผลตอบแทนคาดหวังเฉลี่ยต้องอยู่ระหว่าง 0 ถึง 50% ต่อปี");
      return;
    }

    const cleanedUnits = hUnits.replace(/,/g, "").trim();
    if (cleanedUnits && !/^\d+(\.\d{1,6})?$/.test(cleanedUnits)) {
      setHError("จำนวนหน่วยต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 6 ตำแหน่ง");
      return;
    }

    const payload: InvestmentHoldingFormInput = {
      symbol,
      name,
      assetType: hAssetType,
      targetAllocationPct: Number(targetPct.toFixed(1)),
      expectedAnnualReturnPct: Number(expectedRet.toFixed(2)),
      investedCost: parseSafeNonNegative(hInvestedCost, "0.00"),
      currentValue: parseSafeNonNegative(hCurrentValue, "0.00"),
      dividendsReceived: parseSafeNonNegative(hDividends, "0.00"),
      units: cleanedUnits ? toDecimal(cleanedUnits).toFixed(6) : null,
      currency: hCurrency,
      broker: hBroker.trim() || null,
      note: hNote.trim() || null,
      color: hColor,
    };

    const err = await onSubmit(payload, editingHolding?.id);
    if (err) {
      setHError(err);
      return;
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {hError}
        </p>
      ) : null}

      {/* Part 1: Planning Fields */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
          1. ข้อมูลแผน DCA (ใช้คำนวณสัดส่วนและค่าเฉลี่ย)
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="h-symbol">ชื่อย่อ / Ticker</Label>
            <Input
              id="h-symbol"
              value={hSymbol}
              onChange={(e) => setHSymbol(e.target.value)}
              placeholder="เช่น VOO, SCHD, SCBS&P500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-type">ประเภทสินทรัพย์</Label>
            <AppSelect
              id="h-type"
              value={hAssetType}
              onValueChange={(val) => setHAssetType(val as InvestmentAssetType)}
              options={[
                {
                  value: "etf",
                  label: "ETF / ดัชนีต่างประเทศ",
                  dotColor: "#0f766e",
                },
                {
                  value: "mutual_fund",
                  label: "กองทุนรวม",
                  dotColor: "#10b981",
                },
                {
                  value: "stock",
                  label: "หุ้นรายตัว (ไทย / ต่างประเทศ)",
                  dotColor: "#3b82f6",
                },
                {
                  value: "gold_bond",
                  label: "ทองคำ / ตราสารหนี้",
                  dotColor: "#f59e0b",
                },
                {
                  value: "other",
                  label: "สินทรัพย์ทางเลือกอื่นๆ",
                  dotColor: "#8b5cf6",
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="h-name">ชื่อเต็ม / คำอธิบาย</Label>
          <Input
            id="h-name"
            value={hName}
            onChange={(e) => setHName(e.target.value)}
            placeholder="เช่น Vanguard S&P 500 ETF"
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="h-pct">สัดส่วนเป้าหมายในพอร์ต (%)</Label>
            <Input
              id="h-pct"
              inputMode="decimal"
              value={hTargetPct}
              onChange={(e) => setHTargetPct(e.target.value)}
              placeholder="เช่น 60"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-return">ผลตอบแทนคาดหวังเฉลี่ย (% ต่อปี)</Label>
            <Input
              id="h-return"
              inputMode="decimal"
              value={hExpectedReturn}
              onChange={(e) => setHExpectedReturn(e.target.value)}
              placeholder="เช่น 8.5"
              required
            />
          </div>
        </div>
      </div>

      {/* Part 2: Future Manual Tracking Fields */}
      <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            2. ช่องกรอกยอดจริง (สำหรับอนาคตเมื่อเริ่มซื้อจริง — ใส่ 0 ไว้ก่อนได้)
          </p>
          <p className="text-[11px] text-muted-foreground">
            ดูตัวเลขจากแอปโบรคเกอร์มากรอกอัปเดตเมื่อไหร่ก็ได้
            ระบบจะคำนวณกำไร/ขาดทุนให้ทันที
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="h-cost" className="text-xs">
              เงินต้นที่ลงไปแล้ว (บาท)
            </Label>
            <Input
              id="h-cost"
              inputMode="decimal"
              value={hInvestedCost}
              onChange={(e) => setHInvestedCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="h-val" className="text-xs">
              มูลค่าพอร์ตจริงตอนนี้ (บาท)
            </Label>
            <Input
              id="h-val"
              inputMode="decimal"
              value={hCurrentValue}
              onChange={(e) => setHCurrentValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="h-div" className="text-xs">
              ปันผลรับสะสม (บาท)
            </Label>
            <Input
              id="h-div"
              inputMode="decimal"
              value={hDividends}
              onChange={(e) => setHDividends(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="h-units" className="text-xs">
              จำนวนหน่วย / หุ้นที่ถือ (ไม่บังคับ — ใช้ดึงราคาตลาด)
            </Label>
            <Input
              id="h-units"
              inputMode="decimal"
              value={hUnits}
              onChange={(e) => setHUnits(e.target.value)}
              placeholder="เช่น 2.5"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="h-currency" className="text-xs">
              สกุลเงินราคาตลาด
            </Label>
            <AppSelect
              id="h-currency"
              value={hCurrency}
              onValueChange={(val) => setHCurrency(val as InvestmentCurrency)}
              options={[
                { value: "THB", label: "THB (บาท — หุ้นไทย/กองทุนไทย)" },
                { value: "USD", label: "USD (ดอลลาร์ — ETF/หุ้นอเมริกา)" },
              ]}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="h-broker" className="text-xs">
              แอป / โบรคเกอร์ที่ใช้ (ไม่บังคับ)
            </Label>
            <Input
              id="h-broker"
              value={hBroker}
              onChange={(e) => setHBroker(e.target.value)}
              placeholder="เช่น Dime, InnovestX, Finnomena"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="h-note" className="text-xs">
              หมายเหตุ / แผนการซื้อ (ไม่บังคับ)
            </Label>
            <Input
              id="h-note"
              value={hNote}
              onChange={(e) => setHNote(e.target.value)}
              placeholder="เช่น ซื้อทุกวันที่ 25"
            />
          </div>
        </div>
      </div>

      {/* Color Swatches */}
      <div className="space-y-1.5">
        <Label>สีในกราฟ</Label>
        <div className="flex flex-wrap gap-2">
          {HOLDING_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`เลือกสี ${color}`}
              onClick={() => setHColor(color)}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-transform max-lg:h-9 max-lg:w-9",
                hColor === color
                  ? "scale-110 border-foreground"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isMutating}
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          {editingHolding ? "บันทึกการแก้ไข" : "เพิ่มเข้าพอร์ต"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface InvestmentHoldingDialogProps {
  open: boolean;
  formKey: number;
  onOpenChange: (open: boolean) => void;
  editingHolding: InvestmentHoldingDTO | null;
  defaultTargetPct: string;
  defaultColor: string;
  isMutating: boolean;
  onSubmit: (
    payload: InvestmentHoldingFormInput,
    editingId?: string
  ) => Promise<string | null>;
}

export function InvestmentHoldingDialog({
  open,
  formKey,
  onOpenChange,
  editingHolding,
  defaultTargetPct,
  defaultColor,
  isMutating,
  onSubmit,
}: InvestmentHoldingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingHolding
              ? `แก้ไขสินทรัพย์ (${editingHolding.symbol})`
              : "เพิ่มหุ้น / กองทุนในแผนการลงทุน"}
          </DialogTitle>
          <DialogDescription>
            ระบุหุ้นหรือกองทุนที่สนใจพร้อมสัดส่วน DCA
            และสามารถมากรอกยอดลงทุนจริงในอนาคตได้ทุกเมื่อ
          </DialogDescription>
        </DialogHeader>

        <HoldingFormBody
          key={formKey}
          editingHolding={editingHolding}
          defaultTargetPct={defaultTargetPct}
          defaultColor={defaultColor}
          isMutating={isMutating}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
 * 2. Monthly Portfolio Snapshot Dialog
 * ============================================================================ */

interface SnapshotFormBodyProps {
  defaultMonthKey: string;
  defaultInvestedCost: string;
  defaultMarketValue: string;
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (input: InvestmentSnapshotFormInput) => Promise<string | null>;
}

function SnapshotFormBody({
  defaultMonthKey,
  defaultInvestedCost,
  defaultMarketValue,
  isMutating,
  onClose,
  onSubmit,
}: SnapshotFormBodyProps) {
  const [sMonthKey, setSMonthKey] = useState(defaultMonthKey);
  const [sInvestedCost, setSInvestedCost] = useState(defaultInvestedCost);
  const [sMarketValue, setSMarketValue] = useState(defaultMarketValue);
  const [sDividends, setSDividends] = useState("0.00");
  const [sNote, setSNote] = useState("");
  const [sError, setSError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSError(null);
    if (!/^\d{4}-\d{2}$/.test(sMonthKey)) {
      setSError("กรุณาเลือกเดือนให้ถูกต้อง (YYYY-MM)");
      return;
    }
    const snapInput: InvestmentSnapshotFormInput = {
      monthKey: sMonthKey,
      investedCost: parseSafeNonNegative(sInvestedCost, "0.00"),
      marketValue: parseSafeNonNegative(sMarketValue, "0.00"),
      dividends: parseSafeNonNegative(sDividends, "0.00"),
      note: sNote.trim() || null,
    };

    const err = await onSubmit(snapInput);
    if (err) {
      setSError(err);
      return;
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {sError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {sError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="s-month">เดือนที่บันทึก</Label>
        <AppMonthPicker
          id="s-month"
          value={sMonthKey}
          onChange={setSMonthKey}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-cost">เงินต้นที่ลงสะสมรวม (บาท)</Label>
          <Input
            id="s-cost"
            inputMode="decimal"
            value={sInvestedCost}
            onChange={(e) => setSInvestedCost(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-value">มูลค่าพอร์ตจริงตอนนี้ (บาท)</Label>
          <Input
            id="s-value"
            inputMode="decimal"
            value={sMarketValue}
            onChange={(e) => setSMarketValue(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-div">ปันผลที่ได้รับเดือนนี้ (บาท)</Label>
          <Input
            id="s-div"
            inputMode="decimal"
            value={sDividends}
            onChange={(e) => setSDividends(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-note">หมายเหตุ (ไม่บังคับ)</Label>
          <Input
            id="s-note"
            value={sNote}
            onChange={(e) => setSNote(e.target.value)}
            placeholder="เช่น ซื้อ VOO เพิ่ม 1 ไม้"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isMutating}
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          บันทึกยอดเดือนนี้
        </Button>
      </DialogFooter>
    </form>
  );
}

interface InvestmentSnapshotDialogProps {
  open: boolean;
  formKey: number;
  onOpenChange: (open: boolean) => void;
  defaultMonthKey: string;
  defaultInvestedCost: string;
  defaultMarketValue: string;
  isMutating: boolean;
  onSubmit: (input: InvestmentSnapshotFormInput) => Promise<string | null>;
}

export function InvestmentSnapshotDialog({
  open,
  formKey,
  onOpenChange,
  defaultMonthKey,
  defaultInvestedCost,
  defaultMarketValue,
  isMutating,
  onSubmit,
}: InvestmentSnapshotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>บันทึกยอดพอร์ตประจำเดือน</DialogTitle>
          <DialogDescription>
            กรอกยอดรวมจากแอปโบรคเกอร์เดือนละ 1 ครั้ง
            เพื่อเก็บประวัติการเติบโตจริงของพอร์ต
          </DialogDescription>
        </DialogHeader>

        <SnapshotFormBody
          key={formKey}
          defaultMonthKey={defaultMonthKey}
          defaultInvestedCost={defaultInvestedCost}
          defaultMarketValue={defaultMarketValue}
          isMutating={isMutating}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
 * 3. Record DCA Execution Dialog
 * ============================================================================ */

interface DcaFormBodyProps {
  holding: InvestmentHoldingDTO | null;
  suggestedAmount?: string;
  todayIso: string;
  isDbMode: boolean;
  wallets: WalletDTO[];
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (
    holding: InvestmentHoldingDTO,
    input: RecordDcaExecutionInput
  ) => Promise<string | null>;
}

function DcaFormBody({
  holding,
  suggestedAmount,
  todayIso,
  isDbMode,
  wallets,
  isMutating,
  onClose,
  onSubmit,
}: DcaFormBodyProps) {
  const bankWallet =
    wallets.find((w) => w.type === "bank") ??
    wallets.find((w) => w.type !== "investment") ??
    wallets[0];
  const investWallet =
    wallets.find((w) => w.type === "investment") ??
    wallets.find((w) => w.id !== bankWallet?.id);
  const canTransfer = Boolean(
    isDbMode &&
      bankWallet &&
      investWallet &&
      bankWallet.id !== investWallet.id
  );

  const [dDate, setDDate] = useState(todayIso);
  const [dAmountThb, setDAmountThb] = useState(
    suggestedAmount && toDecimal(suggestedAmount).gt(0)
      ? suggestedAmount
      : "1000.00"
  );
  const [dUnitsBought, setDUnitsBought] = useState("");
  const [dPricePerUnit, setDPricePerUnit] = useState("");
  const [dFeeThb, setDFeeThb] = useState("0.00");
  const [dNote, setDNote] = useState("");
  const [dCreateTransfer, setDCreateTransfer] = useState(
    canTransfer && investWallet?.type === "investment"
  );
  const [dSourceWalletId, setDSourceWalletId] = useState(bankWallet?.id ?? "");
  const [dTargetWalletId, setDTargetWalletId] = useState(
    investWallet?.id ?? ""
  );
  const [dError, setDError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!holding) return;
    setDError(null);

    const cleanedAmt = dAmountThb.replace(/,/g, "").trim();
    const amtDec = toDecimal(parseSafeNonNegative(cleanedAmt, "0.00"));
    if (amtDec.lte(0)) {
      setDError("กรุณากรอกยอดเงินที่ซื้อ DCA มากกว่า 0 บาท");
      return;
    }
    const cleanedUnits = dUnitsBought.replace(/,/g, "").trim();
    if (cleanedUnits && !/^\d+(\.\d{1,6})?$/.test(cleanedUnits)) {
      setDError("จำนวนหน่วยต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 6 ตำแหน่ง");
      return;
    }
    const cleanedPrice = dPricePerUnit.replace(/,/g, "").trim();
    if (cleanedPrice && !/^\d+(\.\d{1,4})?$/.test(cleanedPrice)) {
      setDError("ราคาต่อหน่วยต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 4 ตำแหน่ง");
      return;
    }

    const input: RecordDcaExecutionInput = {
      holdingId: holding.id,
      executedDate: dDate,
      amountThb: amtDec.toFixed(2),
      unitsBought: cleanedUnits ? toDecimal(cleanedUnits).toFixed(6) : null,
      pricePerUnit: cleanedPrice ? toDecimal(cleanedPrice).toFixed(4) : null,
      feeThb: parseSafeNonNegative(dFeeThb, "0.00"),
      note: dNote.trim() || null,
      createTransferTransaction: isDbMode && dCreateTransfer,
      sourceWalletId: isDbMode && dCreateTransfer ? dSourceWalletId : null,
      targetInvestmentWalletId:
        isDbMode && dCreateTransfer ? dTargetWalletId : null,
    };

    const err = await onSubmit(holding, input);
    if (err) {
      setDError(err);
      return;
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {dError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {dError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="d-date">วันที่ซื้อ (เวลาไทย)</Label>
          <AppDatePicker
            id="d-date"
            value={dDate}
            onChange={setDDate}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-amount">ยอดเงินที่ซื้อจริง (บาท)</Label>
          <Input
            id="d-amount"
            inputMode="decimal"
            value={dAmountThb}
            onChange={(e) => setDAmountThb(e.target.value)}
            placeholder="1000.00"
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="d-units" className="text-xs">
            จำนวนหน่วย (ไม่บังคับ)
          </Label>
          <Input
            id="d-units"
            inputMode="decimal"
            value={dUnitsBought}
            onChange={(e) => setDUnitsBought(e.target.value)}
            placeholder="เช่น 0.25"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-price" className="text-xs">
            ราคา/หน่วย (ไม่บังคับ)
          </Label>
          <Input
            id="d-price"
            inputMode="decimal"
            value={dPricePerUnit}
            onChange={(e) => setDPricePerUnit(e.target.value)}
            placeholder="เช่น 540"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-fee" className="text-xs">
            ค่าธรรมเนียม (บาท)
          </Label>
          <Input
            id="d-fee"
            inputMode="decimal"
            value={dFeeThb}
            onChange={(e) => setDFeeThb(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="d-note">หมายเหตุ (ไม่บังคับ)</Label>
        <Input
          id="d-note"
          value={dNote}
          onChange={(e) => setDNote(e.target.value)}
          placeholder="เช่น ซื้อ DCA รอบสิ้นเดือนผ่าน Dime"
        />
      </div>

      {isDbMode && wallets.length >= 2 ? (
        <div className="space-y-2.5 rounded-xl border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={dCreateTransfer}
              onChange={(e) => setDCreateTransfer(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-teal-700"
            />
            <span>สร้างรายการโอนเงินเข้ากระเป๋าลงทุนอัตโนมัติ</span>
          </label>

          {dCreateTransfer ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="d-from-wallet" className="text-xs">
                  โอนจากบัญชี
                </Label>
                <AppSelect
                  id="d-from-wallet"
                  value={dSourceWalletId}
                  onValueChange={setDSourceWalletId}
                  options={wallets.map((w) => ({
                    value: w.id,
                    label: w.name,
                    dotColor: w.color ?? "#0f766e",
                  }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-to-wallet" className="text-xs">
                  เข้ากระเป๋าลงทุน
                </Label>
                <AppSelect
                  id="d-to-wallet"
                  value={dTargetWalletId}
                  onValueChange={setDTargetWalletId}
                  options={wallets
                    .filter((w) => w.id !== dSourceWalletId)
                    .map((w) => ({
                      value: w.id,
                      label: w.name,
                      dotColor: w.color ?? "#10b981",
                    }))}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isMutating}
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          {isMutating ? "กำลังบันทึก..." : "ยืนยันบันทึกซื้อ DCA"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface InvestmentDcaDialogProps {
  open: boolean;
  formKey: number;
  onOpenChange: (open: boolean) => void;
  holding: InvestmentHoldingDTO | null;
  suggestedAmount?: string;
  todayIso: string;
  isDbMode: boolean;
  wallets: WalletDTO[];
  isMutating: boolean;
  onSubmit: (
    holding: InvestmentHoldingDTO,
    input: RecordDcaExecutionInput
  ) => Promise<string | null>;
}

export function InvestmentDcaDialog({
  open,
  formKey,
  onOpenChange,
  holding,
  suggestedAmount,
  todayIso,
  isDbMode,
  wallets,
  isMutating,
  onSubmit,
}: InvestmentDcaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            บันทึกซื้อ DCA {holding ? `• ${holding.symbol}` : ""}
          </DialogTitle>
          <DialogDescription>
            {holding?.name ?? "กรอกยอดเงินที่ซื้อจริงเพื่ออัปเดตต้นทุนสะสม"}
          </DialogDescription>
        </DialogHeader>

        <DcaFormBody
          key={formKey}
          holding={holding}
          suggestedAmount={suggestedAmount}
          todayIso={todayIso}
          isDbMode={isDbMode}
          wallets={wallets}
          isMutating={isMutating}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================================
 * 4. Record Dividend Dialog
 * ============================================================================ */

interface DividendFormBodyProps {
  holding: InvestmentHoldingDTO | null;
  todayIso: string;
  isDbMode: boolean;
  wallets: WalletDTO[];
  incomeCategories: CategoryDTO[];
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (
    holding: InvestmentHoldingDTO,
    input: RecordDividendInput
  ) => Promise<string | null>;
}

function DividendFormBody({
  holding,
  todayIso,
  isDbMode,
  wallets,
  incomeCategories,
  isMutating,
  onClose,
  onSubmit,
}: DividendFormBodyProps) {
  const defaultWallet =
    wallets.find((w) => w.type === "bank") ??
    wallets.find((w) => w.type === "investment") ??
    wallets[0];
  const defaultCategory =
    incomeCategories.find((c) => /ปันผล|ดอกเบี้ย/u.test(c.name)) ??
    incomeCategories[0];

  const [vDate, setVDate] = useState(todayIso);
  const [vAmountThb, setVAmountThb] = useState("");
  const [vNote, setVNote] = useState("");
  const [vCreateIncome, setVCreateIncome] = useState(
    Boolean(isDbMode && defaultWallet && defaultCategory)
  );
  const [vWalletId, setVWalletId] = useState(defaultWallet?.id ?? "");
  const [vCategoryId, setVCategoryId] = useState(defaultCategory?.id ?? "");
  const [vError, setVError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!holding) return;
    setVError(null);

    const amtDec = toDecimal(
      parseSafeNonNegative(vAmountThb.replace(/,/g, "").trim(), "0.00")
    );
    if (amtDec.lte(0)) {
      setVError("กรุณากรอกยอดเงินปันผลมากกว่า 0 บาท");
      return;
    }

    const input: RecordDividendInput = {
      holdingId: holding.id,
      receivedDate: vDate,
      amountThb: amtDec.toFixed(2),
      note: vNote.trim() || null,
      createIncomeTransaction: isDbMode && vCreateIncome,
      walletId: isDbMode && vCreateIncome ? vWalletId : null,
      categoryId: isDbMode && vCreateIncome ? vCategoryId : null,
    };

    const err = await onSubmit(holding, input);
    if (err) {
      setVError(err);
      return;
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {vError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {vError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="v-date">วันที่รับปันผล</Label>
          <AppDatePicker
            id="v-date"
            value={vDate}
            onChange={setVDate}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-amount">ยอดปันผลสุทธิ (บาท)</Label>
          <Input
            id="v-amount"
            inputMode="decimal"
            value={vAmountThb}
            onChange={(e) => setVAmountThb(e.target.value)}
            placeholder="250.00"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="v-note">หมายเหตุ (ไม่บังคับ)</Label>
        <Input
          id="v-note"
          value={vNote}
          onChange={(e) => setVNote(e.target.value)}
          placeholder="เช่น ปันผลไตรมาส 4 หลังหักภาษี"
        />
      </div>

      {isDbMode && wallets.length > 0 && incomeCategories.length > 0 ? (
        <div className="space-y-2.5 rounded-xl border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={vCreateIncome}
              onChange={(e) => setVCreateIncome(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-teal-700"
            />
            <span>บันทึกรายรับเข้ากระเป๋าเงินอัตโนมัติ</span>
          </label>

          {vCreateIncome ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="v-wallet" className="text-xs">
                  กระเป๋าที่รับเงิน
                </Label>
                <AppSelect
                  id="v-wallet"
                  value={vWalletId}
                  onValueChange={setVWalletId}
                  options={wallets.map((w) => ({
                    value: w.id,
                    label: w.name,
                    dotColor: w.color ?? "#0f766e",
                  }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-category" className="text-xs">
                  หมวดหมู่รายรับ
                </Label>
                <AppSelect
                  id="v-category"
                  value={vCategoryId}
                  onValueChange={setVCategoryId}
                  options={incomeCategories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    dotColor: c.color ?? "#10b981",
                  }))}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isMutating}
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          {isMutating ? "กำลังบันทึก..." : "บันทึกเงินปันผล"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface InvestmentDividendDialogProps {
  open: boolean;
  formKey: number;
  onOpenChange: (open: boolean) => void;
  holding: InvestmentHoldingDTO | null;
  todayIso: string;
  isDbMode: boolean;
  wallets: WalletDTO[];
  incomeCategories: CategoryDTO[];
  isMutating: boolean;
  onSubmit: (
    holding: InvestmentHoldingDTO,
    input: RecordDividendInput
  ) => Promise<string | null>;
}

export function InvestmentDividendDialog({
  open,
  formKey,
  onOpenChange,
  holding,
  todayIso,
  isDbMode,
  wallets,
  incomeCategories,
  isMutating,
  onSubmit,
}: InvestmentDividendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            บันทึกเงินปันผล {holding ? `• ${holding.symbol}` : ""}
          </DialogTitle>
          <DialogDescription>
            บวกยอดเงินปันผลสะสมเข้าสินทรัพย์นี้
            พร้อมตัวเลือกจดเป็นรายรับลงบัญชี
          </DialogDescription>
        </DialogHeader>

        <DividendFormBody
          key={formKey}
          holding={holding}
          todayIso={todayIso}
          isDbMode={isDbMode}
          wallets={wallets}
          incomeCategories={incomeCategories}
          isMutating={isMutating}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
