"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
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
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import type { ActionResult, WalletDTO, WalletType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ManageNotice {
  type: "error" | "success";
  message: string;
}

const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  credit_card: "บัตรเครดิต",
  ewallet: "E-Wallet",
  savings_goal: "กระเป๋าเก็บตามเป้าหมาย",
  investment: "พอร์ตหุ้น / การลงทุน",
};

const COLOR_PRESETS = [
  "#0f766e",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
  "#ef4444",
  "#eab308",
  "#64748b",
];

interface ManageWalletsSectionProps {
  wallets: WalletDTO[];
  showArchived: boolean;
  onCreateWallet: (input: {
    name: string;
    type: WalletType;
    initialBalance: string;
    color?: string | null;
  }) => Promise<ActionResult<unknown>>;
  onUpdateWallet: (
    walletId: string,
    input: {
      name: string;
      type: WalletType;
      initialBalance: string;
      color?: string | null;
    }
  ) => Promise<ActionResult<unknown>>;
  onToggleArchiveWallet: (
    walletId: string,
    isArchived: boolean
  ) => Promise<ActionResult<unknown>>;
  onDeleteWallet?: (walletId: string) => Promise<ActionResult<unknown>>;
  onAdjustWalletBalance?: (input: {
    walletId: string;
    actualBalance: string;
  }) => Promise<ActionResult<unknown>>;
  onNotify: (notice: ManageNotice | null) => void;
}

export function ManageWalletsSection({
  wallets,
  showArchived,
  onCreateWallet,
  onUpdateWallet,
  onToggleArchiveWallet,
  onDeleteWallet,
  onAdjustWalletBalance,
  onNotify,
}: ManageWalletsSectionProps) {
  // Wallet modal state
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletDTO | null>(null);
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState<WalletType>("bank");
  const [walletInitial, setWalletInitial] = useState("0.00");
  const [walletColor, setWalletColor] = useState(COLOR_PRESETS[0]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSaving, setWalletSaving] = useState(false);

  // Adjust balance modal state
  const [adjustingWallet, setAdjustingWallet] = useState<WalletDTO | null>(
    null
  );
  const [actualBalanceInput, setActualBalanceInput] = useState("0.00");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [busyWalletAction, setBusyWalletAction] = useState<{
    id: string;
    type: "archive" | "delete";
  } | null>(null);

  const visibleWallets = wallets.filter(
    (w) => showArchived || !w.isArchived
  );
  const archivedWithBalanceCount = wallets.filter(
    (w) => w.isArchived && !toDecimal(w.currentBalance).isZero()
  ).length;

  function openAddWallet() {
    setEditingWallet(null);
    setWalletName("");
    setWalletType("bank");
    setWalletInitial("0.00");
    setWalletColor(COLOR_PRESETS[2]);
    setWalletError(null);
    setWalletDialogOpen(true);
  }

  function openEditWallet(wallet: WalletDTO) {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
    setWalletType(wallet.type);
    setWalletInitial(wallet.initialBalance);
    setWalletColor(wallet.color ?? COLOR_PRESETS[0]);
    setWalletError(null);
    setWalletDialogOpen(true);
  }

  function openAdjustWallet(wallet: WalletDTO) {
    setAdjustingWallet(wallet);
    setActualBalanceInput(wallet.currentBalance);
    setAdjustError(null);
  }

  async function handleWalletSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWalletError(null);
    setWalletSaving(true);
    try {
      const payload = {
        name: walletName,
        type: walletType,
        initialBalance: walletInitial.trim() || "0.00",
        color: walletColor,
      };
      const result = editingWallet
        ? await onUpdateWallet(editingWallet.id, payload)
        : await onCreateWallet(payload);

      if (!result.ok) {
        const firstErr = result.fieldErrors
          ? Object.values(result.fieldErrors).flat()[0]
          : undefined;
        setWalletError(firstErr ?? result.error ?? "บันทึกกระเป๋าเงินไม่สำเร็จ");
        return;
      }
      setWalletDialogOpen(false);
    } finally {
      setWalletSaving(false);
    }
  }

  async function handleAdjustBalanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingWallet || !onAdjustWalletBalance) return;
    setAdjustError(null);
    setAdjustSaving(true);
    try {
      const res = await onAdjustWalletBalance({
        walletId: adjustingWallet.id,
        actualBalance: actualBalanceInput.trim() || "0.00",
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setAdjustError(firstErr ?? res.error ?? "ปรับยอดคงเหลือไม่สำเร็จ");
        return;
      }
      setAdjustingWallet(null);
      onNotify({
        type: "success",
        message: `ปรับยอดคงเหลือของ "${adjustingWallet.name}" เรียบร้อยแล้ว`,
      });
    } finally {
      setAdjustSaving(false);
    }
  }

  async function handleToggleArchiveClick(wallet: WalletDTO) {
    onNotify(null);
    setBusyWalletAction({ id: wallet.id, type: "archive" });
    try {
      const res = await onToggleArchiveWallet(wallet.id, !wallet.isArchived);
      if (!res.ok) {
        onNotify({
          type: "error",
          message: res.error ?? "อัปเดตสถานะกระเป๋าเงินไม่สำเร็จ",
        });
      }
    } finally {
      setBusyWalletAction(null);
    }
  }

  async function handleDeleteWalletClick(wallet: WalletDTO) {
    if (!onDeleteWallet) return;
    onNotify(null);
    setBusyWalletAction({ id: wallet.id, type: "delete" });
    try {
      const res = await onDeleteWallet(wallet.id);
      if (!res.ok) {
        onNotify({
          type: "error",
          message: res.error ?? "ลบกระเป๋าเงินไม่สำเร็จ",
        });
      } else {
        onNotify({
          type: "success",
          message: `ลบกระเป๋าเงิน "${wallet.name}" เรียบร้อยแล้ว`,
        });
      }
    } finally {
      setBusyWalletAction(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">กระเป๋าเงิน / บัญชี</CardTitle>
            <CardDescription>
              รองรับเงินสด ธนาคาร บัตรเครดิต E-Wallet กระเป๋าเป้าหมาย และพอร์ตหุ้น/ลงทุน พร้อมปุ่มปรับยอดให้ตรงกับเงินจริง
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openAddWallet}
            className="shrink-0 gap-1 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มกระเป๋า</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {archivedWithBalanceCount > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              มีกระเป๋าที่ถูกซ่อน (Archive) และยังมียอดคงเหลืออยู่{" "}
              {archivedWithBalanceCount} กระเป๋า
              (ยอดของกระเป๋าที่ซ่อนจะไม่ถูกนับรวมใน Net Worth บนหน้าภาพรวม)
            </div>
          ) : null}
          {visibleWallets.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีกระเป๋าเงิน
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleWallets.map((wallet) => {
                const bal = toDecimal(wallet.currentBalance);
                return (
                  <div
                    key={wallet.id}
                    className={cn(
                      "flex flex-col justify-between gap-3 rounded-xl border bg-background p-4",
                      wallet.isArchived && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: wallet.color ?? "#0f766e",
                            }}
                          />
                          <p className="truncate font-semibold">{wallet.name}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {WALLET_TYPE_LABEL[wallet.type]}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 max-lg:gap-1.5">
                        {onAdjustWalletBalance ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9"
                            aria-label="ปรับยอดคงเหลือปัจจุบัน"
                            title="ปรับยอดคงเหลือให้ตรงกับเงินจริง"
                            onClick={() => openAdjustWallet(wallet)}
                          >
                            <Scale className="h-3.5 w-3.5 text-teal-600" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="max-lg:size-9"
                          aria-label="แก้ไขกระเป๋าเงิน"
                          title="แก้ไข"
                          onClick={() => openEditWallet(wallet)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="max-lg:size-9"
                          aria-label={
                            wallet.isArchived ? "กู้คืนกระเป๋า" : "ซ่อนกระเป๋า"
                          }
                          title={wallet.isArchived ? "กู้คืน" : "ซ่อนไว้ (Archive)"}
                          loading={
                            busyWalletAction?.id === wallet.id &&
                            busyWalletAction.type === "archive"
                          }
                          disabled={busyWalletAction?.id === wallet.id}
                          onClick={() => handleToggleArchiveClick(wallet)}
                        >
                          {wallet.isArchived ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {onDeleteWallet ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบกระเป๋าเงิน"
                            title="ลบถาวร (เฉพาะกระเป๋าที่ยังไม่มีรายการ)"
                            className="ml-0.5 text-destructive hover:text-destructive max-lg:size-9"
                            loading={
                              busyWalletAction?.id === wallet.id &&
                              busyWalletAction.type === "delete"
                            }
                            disabled={busyWalletAction?.id === wallet.id}
                            onClick={() => handleDeleteWalletClick(wallet)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between border-t pt-2.5 text-xs">
                      <span className="text-muted-foreground">
                        {wallet.type === "credit_card" && bal.isNegative()
                          ? "ยอดค้างชำระ"
                          : "ยอดคงเหลือ"}
                      </span>
                      <span
                        className={cn(
                          "text-base font-bold tabular-nums",
                          wallet.type === "credit_card" && bal.isNegative()
                            ? "text-amber-600"
                            : "text-foreground"
                        )}
                      >
                        ฿
                        {formatMoneyDisplay(
                          wallet.type === "credit_card" && bal.isNegative()
                            ? bal.abs()
                            : bal
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet Modal */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingWallet ? "แก้ไขกระเป๋าเงิน" : "เพิ่มกระเป๋าเงินใหม่"}
            </DialogTitle>
            <DialogDescription>
              ตั้งชื่อ เลือกประเภท และกำหนดยอดเริ่มต้นของกระเป๋าเงิน
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWalletSubmit} className="space-y-4">
            <div>
              <SmoothExpand watchKey={walletError ?? ""} className="-mx-1">
                {walletError ? (
                  <p className="mb-4 animate-mf-fade-up rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {walletError}
                  </p>
                ) : null}
              </SmoothExpand>

              {!editingWallet ? (
                <div className="mb-3 space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    เทมเพลตกระเป๋าแยกยอดนิยม:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "📈 พอร์ตหุ้น / DCA",
                        name: "พอร์ตหุ้น / DCA",
                        type: "investment" as WalletType,
                        color: "#10b981",
                      },
                      {
                        label: "💝 กระเป๋าซื้อของให้แฟน",
                        name: "กระเป๋าซื้อของให้แฟน",
                        type: "savings_goal" as WalletType,
                        color: "#ec4899",
                      },
                      {
                        label: "⌚ กระเป๋าของที่อยากได้",
                        name: "กระเป๋าของที่อยากได้",
                        type: "savings_goal" as WalletType,
                        color: "#f97316",
                      },
                      {
                        label: "❄️ บัญชีเงินเย็นสำรอง",
                        name: "บัญชีเงินเย็นสำรอง",
                        type: "savings_goal" as WalletType,
                        color: "#3b82f6",
                      },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setWalletName(preset.name);
                          setWalletType(preset.type);
                          setWalletColor(preset.color);
                        }}
                        className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-teal-600/40 hover:bg-teal-600/10 hover:text-foreground"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="wallet-name">ชื่อกระเป๋าเงิน / บัญชี</Label>
                <Input
                  id="wallet-name"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="เช่น SCB ออมทรัพย์, พอร์ตหุ้น, ของที่อยากได้"
                  required
                />
              </div>
            </div>

            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wallet-type">ประเภท</Label>
                  <AppSelect
                    id="wallet-type"
                    value={walletType}
                    onValueChange={(nextValue) =>
                      setWalletType(nextValue as WalletType)
                    }
                    options={[
                      { value: "cash", label: "เงินสด", dotColor: "#0f766e" },
                      {
                        value: "bank",
                        label: "บัญชีธนาคาร (ใช้จ่ายทั่วไป)",
                        dotColor: "#3b82f6",
                      },
                      { value: "ewallet", label: "E-Wallet", dotColor: "#8b5cf6" },
                      {
                        value: "savings_goal",
                        label:
                          "กระเป๋าเก็บตามเป้าหมาย (ของที่อยากได้ / แฟน / เงินเย็น)",
                        dotColor: "#f97316",
                      },
                      {
                        value: "investment",
                        label: "พอร์ตหุ้น / กองทุน / DCA",
                        dotColor: "#10b981",
                      },
                      {
                        value: "credit_card",
                        label: "บัตรเครดิต",
                        dotColor: "#eab308",
                      },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wallet-initial">ยอดตั้งต้น (บาท)</Label>
                  <Input
                    id="wallet-initial"
                    inputMode="decimal"
                    value={walletInitial}
                    onChange={(e) => setWalletInitial(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <SmoothExpand watchKey={walletType === "credit_card"} className="-mx-1">
                {walletType === "credit_card" ? (
                  <p className="mt-3 animate-mf-fade-up rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    สำหรับบัตรเครดิต หากมียอดค้างชำระตั้งต้นให้ใส่เครื่องหมายลบ เช่น{" "}
                    <span className="font-mono font-semibold">-5000.00</span>
                  </p>
                ) : null}
              </SmoothExpand>
            </div>

            <div className="space-y-1.5">
              <Label>สีประจำกระเป๋า</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`เลือกสี ${color}`}
                    onClick={() => setWalletColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform max-lg:h-9 max-lg:w-9",
                      walletColor === color
                        ? "scale-110 border-foreground"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={walletSaving}
                onClick={() => setWalletDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                loading={walletSaving}
                loadingText="กำลังบันทึก..."
              >
                บันทึก
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Wallet Current Balance Modal */}
      <Dialog
        open={Boolean(adjustingWallet)}
        onOpenChange={(open) => {
          if (!open) setAdjustingWallet(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ปรับยอดคงเหลือปัจจุบัน ({adjustingWallet?.name})
            </DialogTitle>
            <DialogDescription>
              ระบุยอดเงินจริงที่มีอยู่ในกระเป๋าตอนนี้ ระบบจะปรับยอดตั้งต้นให้อัตโนมัติโดยไม่กระทบรายการรับ-จ่ายเดิม
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdjustBalanceSubmit} className="space-y-4">
            {adjustError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {adjustError}
              </p>
            ) : null}

            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              ยอดคงเหลือในระบบปัจจุบัน:{" "}
              <strong className="tabular-nums">
                ฿
                {adjustingWallet
                  ? formatMoneyDisplay(adjustingWallet.currentBalance)
                  : "0.00"}
              </strong>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actual-balance">
                ยอดเงินจริงที่มีอยู่ปัจจุบัน (บาท)
              </Label>
              <Input
                id="actual-balance"
                inputMode="decimal"
                value={actualBalanceInput}
                onChange={(e) => setActualBalanceInput(e.target.value)}
                placeholder="0.00"
                required
              />
              {adjustingWallet?.type === "credit_card" ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  สำหรับบัตรเครดิต ให้ระบุยอดหนี้ค้างชำระเป็นค่าติดลบ (เช่น -3500.00) หรือ 0.00 หากจ่ายครบแล้ว
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={adjustSaving}
                onClick={() => setAdjustingWallet(null)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                loading={adjustSaving}
                loadingText="กำลังบันทึก..."
              >
                ยืนยันการปรับยอด
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
