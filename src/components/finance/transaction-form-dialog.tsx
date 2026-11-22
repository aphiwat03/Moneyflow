"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Camera,
  ChevronDown,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import type { TransactionFormInput } from "@/actions/transactions";
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
import { AppDatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { SmoothExpand } from "@/components/ui/smooth-expand";
import { toast } from "@/components/ui/toast";
import {
  getBangkokCurrentTime,
  getBangkokToday,
  getTransactionDisplayTime,
} from "@/lib/date";
import { formatMoneyDisplay } from "@/lib/decimal";
import { pickSlipWalletId } from "@/lib/slip-parser";
import { extractTaxAlertFromResult } from "@/lib/thai-tax";
import type {
  SlipOcrProviderName,
  SlipOcrScanResponse,
} from "@/lib/slip-ocr/types";
import type {
  ActionResult,
  CategoryDTO,
  TransactionDTO,
  TransactionType,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SLIP_BYTES = 4 * 1024 * 1024;
const ALLOWED_SLIP_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  initialTransaction?: TransactionDTO | null;
  demoMode?: boolean;
  onSubmit: (
    values: TransactionFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
}

const TYPE_OPTIONS: Array<{
  value: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
  pillClass: string;
}> = [
  {
    value: "expense",
    label: "รายจ่าย",
    icon: ArrowUpRight,
    pillClass: "bg-rose-600",
  },
  {
    value: "income",
    label: "รายรับ",
    icon: ArrowDownLeft,
    pillClass: "bg-emerald-600",
  },
  {
    value: "transfer",
    label: "โอนย้าย",
    icon: ArrowLeftRight,
    pillClass: "bg-sky-600",
  },
];

const TYPE_ORDER: Record<TransactionType, number> = {
  expense: 0,
  income: 1,
  transfer: 2,
};

function TransactionFormBody({
  wallets,
  categories,
  initialTransaction,
  demoMode = false,
  onClose,
  onSubmit,
}: {
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  initialTransaction?: TransactionDTO | null;
  demoMode?: boolean;
  onClose: () => void;
  onSubmit: (
    values: TransactionFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
}) {
  const activeWallets = wallets.filter(
    (w) =>
      !w.isArchived ||
      w.id === initialTransaction?.walletId ||
      w.id === initialTransaction?.toWalletId
  );

  const [type, setType] = useState<TransactionType>(
    initialTransaction?.type ?? "expense"
  );
  const activeOption =
    TYPE_OPTIONS.find((opt) => opt.value === type) ?? TYPE_OPTIONS[0];
  const activeIndex = TYPE_ORDER[type];

  const [amount, setAmount] = useState(initialTransaction?.amount ?? "");
  const [walletId, setWalletId] = useState(
    initialTransaction?.walletId ?? activeWallets[0]?.id ?? ""
  );
  const [toWalletId, setToWalletId] = useState(
    initialTransaction?.toWalletId ?? activeWallets[1]?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(() => {
    if (initialTransaction) {
      return initialTransaction.categoryId ?? "";
    }
    return (
      categories.find((c) => c.type === "expense" && !c.isArchived)?.id ?? ""
    );
  });
  const [transactionDate, setTransactionDate] = useState(
    () => initialTransaction?.transactionDate ?? getBangkokToday()
  );
  const [transactionTime, setTransactionTime] = useState(() =>
    initialTransaction
      ? (getTransactionDisplayTime(initialTransaction) ?? "")
      : getBangkokCurrentTime()
  );
  const [note, setNote] = useState(initialTransaction?.note ?? "");
  const [recipientName, setRecipientName] = useState(
    initialTransaction?.recipientName ?? ""
  );
  const [recipientBank, setRecipientBank] = useState(
    initialTransaction?.recipientBank ?? ""
  );
  const [recipientAccount, setRecipientAccount] = useState(
    initialTransaction?.recipientAccount ?? ""
  );
  const [recipientOpen, setRecipientOpen] = useState(() =>
    Boolean(
      initialTransaction?.recipientName ||
        initialTransaction?.recipientBank ||
        initialTransaction?.recipientAccount
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // e-Slip attachment & OCR scan state (fixed-height bar so layout never shifts)
  const [slipFileMeta, setSlipFileMeta] = useState<{
    name: string;
    sizeKb: number;
    previewUrl: string;
  } | null>(null);
  const [slipProvider, setSlipProvider] =
    useState<SlipOcrProviderName>("local");
  const [isScanningSlip, setIsScanningSlip] = useState(false);
  const slipInputRef = useRef<HTMLInputElement | null>(null);
  const slipFileRef = useRef<File | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const url = slipFileMeta?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [slipFileMeta]);

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
    };
  }, []);

  function applyMatchedSlipWallet(bankHint: string | null): {
    switchedWalletName: string | null;
    isStillCash: boolean;
  } {
    const matchedWalletId = pickSlipWalletId(activeWallets, walletId, bankHint);
    if (matchedWalletId) {
      setWalletId(matchedWalletId);
      if (toWalletId === matchedWalletId) {
        const fallbackTo = activeWallets.find((w) => w.id !== matchedWalletId);
        setToWalletId(fallbackTo?.id ?? "");
      }
    }
    const targetWallet = activeWallets.find(
      (w) => w.id === (matchedWalletId ?? walletId)
    );
    return {
      switchedWalletName: matchedWalletId ? (targetWallet?.name ?? null) : null,
      isStillCash: targetWallet?.type === "cash",
    };
  }

  async function runSlipScan(file: File, provider: SlipOcrProviderName) {
    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;

    setIsScanningSlip(true);
    setError(null);

    try {
      if (demoMode) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            controller.signal.removeEventListener("abort", onAbort);
            resolve();
          }, 350);
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          };
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
        if (controller.signal.aborted) return;

        const demoBankHint = provider === "gemini" ? "K PLUS" : "SCB";
        const demoAmount = provider === "gemini" ? "145.00" : "285.50";
        const demoRecipientName =
          provider === "gemini" ? "ร้านกาแฟอเมซอน" : "7-Eleven สาขาสามย่าน";
        const demoRecipientBank = provider === "gemini" ? "K PLUS" : "SCB";
        const demoRecipientAccount =
          provider === "gemini" ? "xxx-x-x4821-x" : "xxx-x-x9032-x";
        const demoNote =
          provider === "gemini"
            ? "ร้านกาแฟอเมซอน (Gemini Mock)"
            : "7-Eleven สาขาสามย่าน (SCB)";
        applyMatchedSlipWallet(demoBankHint);
        setAmount(demoAmount);
        setTransactionDate(getBangkokToday());
        setTransactionTime(getBangkokCurrentTime());
        setNote((prev) => (prev.trim() ? prev : demoNote));
        setRecipientName((prev) => (prev.trim() ? prev : demoRecipientName));
        setRecipientBank((prev) => (prev.trim() ? prev : demoRecipientBank));
        setRecipientAccount((prev) =>
          prev.trim() ? prev : demoRecipientAccount
        );
        setRecipientOpen(true);
        toast.warning(
          provider === "gemini"
            ? "โหมด Demo: จำลองผลลัพธ์ Gemini"
            : "โหมด Demo: จำลองการอ่านสลิป",
          "เข้าสู่ระบบจริงเพื่อส่งรูปเข้า OpenThai2.1 OCR ในเครื่องของคุณ"
        );
        return;
      }

      const body = new FormData();
      body.append("file", file);
      body.append("provider", provider);

      const response = await fetch("/api/slip-ocr", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | SlipOcrScanResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        const message =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "ไม่สามารถอ่านข้อมูลจากสลิปได้ กรุณากรอกข้อมูลด้วยตัวเอง";
        toast.error("อ่านสลิปไม่ผ่าน", message);
        return;
      }

      const data = payload as SlipOcrScanResponse;
      if (controller.signal.aborted) return;

      if (data.amount) {
        setAmount(data.amount);
      }
      if (data.transactionDate) {
        setTransactionDate(data.transactionDate);
      }
      if (data.transactionTime) {
        setTransactionTime(data.transactionTime);
      }
      if (data.suggestedNote) {
        setNote((prev) => (prev.trim() ? prev : data.suggestedNote!));
      }
      if (data.recipientName) {
        setRecipientName((prev) => (prev.trim() ? prev : data.recipientName!));
      }
      if (data.recipientBank) {
        setRecipientBank((prev) => (prev.trim() ? prev : data.recipientBank!));
      }
      if (data.recipientAccount) {
        setRecipientAccount((prev) =>
          prev.trim() ? prev : data.recipientAccount!
        );
      }
      if (data.recipientName || data.recipientBank || data.recipientAccount) {
        setRecipientOpen(true);
      }

      const { switchedWalletName, isStillCash } = applyMatchedSlipWallet(
        data.bankHint
      );
      const noBankWalletHint = isStillCash
        ? "ยังไม่มีกระเป๋าบัญชีธนาคาร/e-Wallet (คงกระเป๋าเงินสดไว้)"
        : null;
      const walletSwitchedHint = switchedWalletName
        ? `เลือกบัญชี "${switchedWalletName}" ให้อัตโนมัติ`
        : null;

      const bankPart = data.bankHint ? ` · ${data.bankHint}` : "";
      const timePart = data.durationMs > 0 ? ` (${data.durationMs} ms)` : "";
      const title = data.isMock
        ? `อ่านสลิปสำเร็จ (Gemini Mock)${bankPart}`
        : `อ่านสลิปสำเร็จ${bankPart}${timePart}`;
      const detailParts = [
        walletSwitchedHint,
        noBankWalletHint,
        ...(data.warnings.length > 0
          ? data.warnings
          : ["กรุณาตรวจสอบยอดเงินและวันที่ก่อนกดบันทึก"]),
      ].filter(Boolean);
      const detail = detailParts.join(" · ");

      if (!data.amount || data.isMock || data.warnings.length > 0) {
        toast.warning(title, detail);
      } else {
        toast.success(title, detail);
      }
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        controller.signal.aborted
      ) {
        return;
      }
      toast.error(
        "เชื่อมต่อระบบอ่านสลิปไม่สำเร็จ",
        "กรุณากรอกยอดเงินและวันที่ด้วยตัวเอง"
      );
    } finally {
      if (scanAbortRef.current === controller) {
        setIsScanningSlip(false);
      }
    }
  }

  function attachSlipFile(file: File | null | undefined) {
    if (!file) return;
    if (!ALLOWED_SLIP_TYPES.has(file.type)) {
      toast.error(
        "ไฟล์ไม่รองรับ",
        "กรุณาเลือกไฟล์รูปภาพสลิป (.png, .jpg, .webp)"
      );
      return;
    }
    if (file.size > MAX_SLIP_BYTES) {
      toast.error("ไฟล์มีขนาดใหญ่เกินไป", "ขนาดไฟล์สลิปต้องไม่เกิน 4 MB");
      return;
    }
    slipFileRef.current = file;
    const previewUrl = URL.createObjectURL(file);
    setSlipFileMeta({
      name: file.name || "slip-image.png",
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      previewUrl,
    });
    setError(null);
    void runSlipScan(file, slipProvider);
  }

  function handleRemoveSlip() {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    slipFileRef.current = null;
    setIsScanningSlip(false);
    setSlipFileMeta(null);
  }

  function handleSwitchProvider(next: SlipOcrProviderName) {
    if (next === slipProvider) return;
    setSlipProvider(next);
    if (slipFileRef.current) {
      void runSlipScan(slipFileRef.current, next);
    }
  }

  function handleFormPaste(e: React.ClipboardEvent<HTMLFormElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          attachSlipFile(file);
          return;
        }
      }
    }
  }

  const availableCategories = categories.filter(
    (c) =>
      c.type === (type === "income" ? "income" : "expense") &&
      (!c.isArchived || c.id === initialTransaction?.categoryId)
  );

  function handleTypeChange(nextType: TransactionType) {
    if (nextType === type) return;

    setType(nextType);
    setError(null);

    if (nextType === "transfer") {
      setCategoryId("");
      if (!toWalletId || toWalletId === walletId) {
        const other = activeWallets.find((w) => w.id !== walletId);
        setToWalletId(other?.id ?? "");
      }
    } else {
      setToWalletId("");
      const validCat = categories.find(
        (c) => c.id === categoryId && c.type === nextType && !c.isArchived
      );
      if (!validCat) {
        const firstMatching = categories.find(
          (c) => c.type === nextType && !c.isArchived
        );
        setCategoryId(firstMatching?.id ?? "");
      }
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!walletId) {
      setError("กรุณาเลือกกระเป๋าเงิน");
      return;
    }
    if (type === "transfer" && !toWalletId) {
      setError("กรุณาเลือกกระเป๋าปลายทาง");
      return;
    }
    setIsSubmitting(true);

    try {
      const payload: TransactionFormInput = {
        type,
        walletId,
        toWalletId: type === "transfer" ? toWalletId : null,
        categoryId: type === "transfer" ? null : categoryId,
        amount: amount.trim(),
        transactionDate,
        transactionTime: transactionTime.trim() || null,
        note: note.trim() || null,
        recipientName: recipientName.trim() || null,
        recipientBank: recipientBank.trim() || null,
        recipientAccount: recipientAccount.trim() || null,
      };

      const result = await onSubmit(payload, initialTransaction?.id);
      if (!result.ok) {
        const firstFieldErr = result.fieldErrors
          ? Object.values(result.fieldErrors).flat()[0]
          : undefined;
        setError(firstFieldErr ?? result.error ?? "บันทึกข้อมูลไม่สำเร็จ");
        return;
      }

      const taxAlert = extractTaxAlertFromResult(result.data);
      if (taxAlert) {
        toast[taxAlert.kind](taxAlert.title, taxAlert.detail);
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      onPaste={handleFormPaste}
      className="space-y-3.5"
    >
      <div>
        {/* GPU-only Sliding Segmented Switch */}
        <div className="relative grid grid-cols-3 rounded-xl bg-muted p-1">
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg shadow-sm transition-[transform,background-color] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
              activeOption.pillClass
            )}
            style={{
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            }}
          />
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleTypeChange(opt.value)}
                className={cn(
                  "relative z-10 flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <SmoothExpand watchKey={error ?? ""}>
          {error ? (
            <div
              role="alert"
              className="mt-3 animate-mf-fade-up rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          ) : null}
        </SmoothExpand>
      </div>

      {/* Direct Slip Upload (fixed height so form never shifts) */}
      <div>
        <input
          ref={slipInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            attachSlipFile(file);
          }}
        />

        <div className="flex h-10 w-full items-center gap-1.5">
          {!slipFileMeta ? (
            <button
              type="button"
              onClick={() => slipInputRef.current?.click()}
              className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-muted/25 px-3 text-left text-xs font-medium transition-colors hover:border-teal-600/50 hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Camera className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                <span className="truncate">แนบสลิปอ่านยอดอัตโนมัติ</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300">
                <Upload className="h-3 w-3" />
                <span className="hidden sm:inline">อัปโหลดรูป</span>
              </span>
            </button>
          ) : (
            <div className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-teal-600/30 bg-teal-600/5 px-2.5 text-xs">
              {isScanningSlip ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 text-teal-800 dark:text-teal-200">
                  <Image
                    src={slipFileMeta.previewUrl}
                    alt="ตัวอย่างรูปสลิป"
                    width={24}
                    height={24}
                    unoptimized
                    className="h-6 w-6 shrink-0 rounded border object-cover opacity-70"
                  />
                  <Loader2
                    aria-label="กำลังอ่านสลิป"
                    className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600"
                  />
                  <span className="truncate font-medium">
                    {slipProvider === "gemini"
                      ? "กำลังจำลองอ่านสลิป..."
                      : "กำลังอ่านสลิป..."}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => slipInputRef.current?.click()}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title="คลิกเพื่อเปลี่ยนรูปสลิป"
                >
                  <Image
                    src={slipFileMeta.previewUrl}
                    alt="ตัวอย่างรูปสลิป"
                    width={24}
                    height={24}
                    unoptimized
                    className="h-6 w-6 shrink-0 rounded border object-cover"
                  />
                  <span className="truncate font-medium text-foreground">
                    {slipFileMeta.name}
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground tabular-nums sm:inline">
                    ({slipFileMeta.sizeKb} KB)
                  </span>
                </button>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {!isScanningSlip ? (
                  <button
                    type="button"
                    onClick={() => slipInputRef.current?.click()}
                    className="rounded-md px-1.5 py-1 text-[11px] font-medium text-teal-700 transition-colors hover:bg-teal-600/10 dark:text-teal-300"
                  >
                    เปลี่ยนรูป
                  </button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleRemoveSlip}
                  aria-label={isScanningSlip ? "ยกเลิกการอ่านสลิป" : "ลบรูปสลิป"}
                  className="h-7 w-7 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div
            role="group"
            aria-label="ตัวอ่านสลิป"
            className="flex h-10 shrink-0 items-center rounded-xl border border-border bg-muted/40 p-0.5 text-[11px] font-medium"
          >
            <button
              type="button"
              onClick={() => handleSwitchProvider("local")}
              aria-pressed={slipProvider === "local"}
              className={cn(
                "h-8 rounded-lg px-2 transition-colors",
                slipProvider === "local"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => handleSwitchProvider("gemini")}
              aria-pressed={slipProvider === "gemini"}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg px-2 transition-colors",
                slipProvider === "gemini"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Gemini</span>
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Amount Input */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-amount">จำนวนเงิน (บาท)</Label>

        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base font-semibold text-muted-foreground">
            ฿
          </span>
          <Input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isScanningSlip}
            className="h-11 pl-8 text-lg font-semibold tabular-nums lg:text-lg"
            required
          />
        </div>
      </div>

      {/* Wallet & Category / To-Wallet in a single side-by-side row (compact, zero scroll) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tx-wallet">
            {type === "transfer" ? "โอนจากกระเป๋า" : "กระเป๋าเงิน / บัญชี"}
          </Label>
          <AppSelect
            id="tx-wallet"
            value={walletId}
            onValueChange={setWalletId}
            placeholder="เลือกกระเป๋าเงิน"
            options={activeWallets.map((w) => ({
              value: w.id,
              label: w.name,
              dotColor: w.color ?? "#0f766e",
              badge: `฿${formatMoneyDisplay(w.currentBalance)}`,
            }))}
          />
        </div>

        {type === "transfer" ? (
          <div className="space-y-1.5">
            <Label htmlFor="tx-to-wallet">ไปยังกระเป๋า</Label>
            <AppSelect
              id="tx-to-wallet"
              value={toWalletId}
              onValueChange={setToWalletId}
              placeholder="เลือกกระเป๋าปลายทาง"
              options={activeWallets
                .filter((w) => w.id !== walletId)
                .map((w) => ({
                  value: w.id,
                  label: w.name,
                  dotColor: w.color ?? "#0f766e",
                  badge: `฿${formatMoneyDisplay(w.currentBalance)}`,
                }))}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="tx-category">หมวดหมู่</Label>
            {availableCategories.length === 0 ? (
              <p className="flex h-10 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                ยังไม่มีหมวดหมู่สำหรับประเภทนี้
              </p>
            ) : (
              <AppSelect
                id="tx-category"
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="เลือกหมวดหมู่"
                options={availableCategories.map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                  dotColor: cat.color ?? "#64748b",
                }))}
              />
            )}
          </div>
        )}
      </div>

      {/* Date, Time & Note */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">วันที่ (เวลาไทย)</Label>
            <AppDatePicker
              id="tx-date"
              value={transactionDate}
              onChange={setTransactionDate}
              disabled={isScanningSlip}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-time">เวลา (เวลาไทย)</Label>
            <Input
              id="tx-time"
              type="time"
              value={transactionTime}
              onChange={(e) => setTransactionTime(e.target.value)}
              disabled={isScanningSlip}
              className="h-10 tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tx-note">รายละเอียด / หมายเหตุ</Label>
          <Input
            id="tx-note"
            type="text"
            placeholder="เช่น ข้าวกลางวัน, ค่าน้ำ..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-10"
            maxLength={1000}
          />
        </div>
      </div>

      {/* Collapsible Recipient Metadata (adds 1 slim button when collapsed; auto-opens on OCR slip match) */}
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2">
        <button
          type="button"
          onClick={() => setRecipientOpen((prev) => !prev)}
          aria-expanded={recipientOpen}
          className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            <span className="truncate">
              {recipientName.trim() || recipientBank.trim() || recipientAccount.trim()
                ? `ผู้รับ: ${recipientName.trim() || recipientAccount.trim()}${recipientBank.trim() ? ` (${recipientBank.trim()})` : ""}`
                : "เพิ่มข้อมูลผู้รับโอน / ชื่อบัญชี (ไม่บังคับ)"}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              recipientOpen && "rotate-180"
            )}
          />
        </button>

        <SmoothExpand watchKey={recipientOpen ? "open" : "closed"}>
          {recipientOpen ? (
            <div className="mt-2.5 space-y-2.5 border-t border-border/60 pt-2.5">
              <div className="space-y-1">
                <Label htmlFor="tx-recipient-name" className="text-xs">
                  ชื่อบัญชีผู้รับ / ร้านค้า
                </Label>
                <Input
                  id="tx-recipient-name"
                  type="text"
                  placeholder="เช่น นาย สมชาย ใจดี หรือ ร้านกาแฟ"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-9 text-sm"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="tx-recipient-bank" className="text-xs">
                    ธนาคารปลายทาง
                  </Label>
                  <Input
                    id="tx-recipient-bank"
                    type="text"
                    placeholder="เช่น SCB, K PLUS, PromptPay"
                    value={recipientBank}
                    onChange={(e) => setRecipientBank(e.target.value)}
                    className="h-9 text-sm"
                    maxLength={60}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tx-recipient-account" className="text-xs">
                    เลขบัญชี (ปิดอัตโนมัติเหลือ 4 ตัวท้าย)
                  </Label>
                  <Input
                    id="tx-recipient-account"
                    type="text"
                    placeholder="เช่น xxx-x-x1234-x"
                    value={recipientAccount}
                    onChange={(e) => setRecipientAccount(e.target.value)}
                    className="h-9 text-sm tabular-nums"
                    maxLength={64}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </SmoothExpand>
      </div>

      <DialogFooter className="pt-1">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={onClose}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          loading={isSubmitting}
          loadingText="กำลังบันทึก..."
          disabled={isScanningSlip}
        >
          {isScanningSlip
            ? "กำลังอ่านสลิป..."
            : initialTransaction
              ? "บันทึกการแก้ไข"
              : "บันทึกรายการ"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  wallets,
  categories,
  initialTransaction,
  demoMode = false,
  onSubmit,
}: TransactionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-h-[84dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialTransaction ? "แก้ไขรายการ" : "บันทึกรายการใหม่"}
          </DialogTitle>
          <DialogDescription>
            เลือกประเภทรายการ กรอกยอดเงิน และระบุกระเป๋าเงินที่ใช้งาน
          </DialogDescription>
        </DialogHeader>

        <TransactionFormBody
          key={initialTransaction?.id ?? "new"}
          wallets={wallets}
          categories={categories}
          initialTransaction={initialTransaction}
          demoMode={demoMode}
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
