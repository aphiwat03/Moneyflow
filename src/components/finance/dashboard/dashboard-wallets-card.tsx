"use client";

import Decimal from "decimal.js";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoneyDisplay, sumMoney, toDecimal } from "@/lib/decimal";
import type {
  ComputedAllocationItem,
  WalletDTO,
  WalletType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  cash: "เงินสด",
  bank: "ธนาคาร",
  credit_card: "บัตรเครดิต",
  ewallet: "E-Wallet",
  savings_goal: "กระเป๋าเป้าหมาย",
  investment: "พอร์ตหุ้น / ลงทุน",
};

interface DashboardWalletsCardProps {
  activeWallets: WalletDTO[];
  spendingWallets: WalletDTO[];
  goalWallets: WalletDTO[];
  creditWallets: WalletDTO[];
  spendingTotal: Decimal;
  goalWalletsTotal: Decimal;
  creditCardDebtTotal: string;
  linkedAllocationsByWalletId: Map<string, ComputedAllocationItem[]>;
  onOpenManage?: () => void;
}

export function DashboardWalletsCard({
  activeWallets,
  spendingWallets,
  goalWallets,
  creditWallets,
  spendingTotal,
  goalWalletsTotal,
  creditCardDebtTotal,
  linkedAllocationsByWalletId,
  onOpenManage,
}: DashboardWalletsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-teal-600" />
            <span>ยอดเงินจริงในแต่ละกระเป๋า</span>
          </CardTitle>
          <CardDescription>
            แยกให้เห็นชัดระหว่างเงินใช้จ่ายทั่วไป กับกระเป๋าเก็บตามเป้าหมาย / หุ้น
          </CardDescription>
        </div>
        {onOpenManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenManage}
            className="shrink-0"
          >
            จัดการกระเป๋า &amp; ปรับยอด
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {activeWallets.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีกระเป๋าเงินที่เปิดใช้งาน
          </p>
        ) : (
          <>
            {/* Section 1: Spending Wallets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">
                  💳 กระเป๋าใช้จ่ายทั่วไป
                </span>
                <span className="font-semibold text-teal-700 tabular-nums dark:text-teal-300">
                  รวม ฿{formatMoneyDisplay(spendingTotal)}
                </span>
              </div>
              {spendingWallets.length === 0 ? (
                <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                  ยังไม่มีกระเป๋าใช้จ่ายทั่วไป
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {spendingWallets.map((wallet) => {
                    const bal = toDecimal(wallet.currentBalance);
                    return (
                      <div
                        key={wallet.id}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: wallet.color ?? "#0f766e",
                              }}
                            />
                            <p className="truncate font-medium">{wallet.name}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {WALLET_TYPE_LABEL[wallet.type]}
                          </p>
                        </div>

                        <p
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            bal.isNegative() ? "text-rose-600" : "text-foreground"
                          )}
                        >
                          ฿{formatMoneyDisplay(bal)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Goal / Investment Wallets */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-foreground">
                  🎯 กระเป๋าเก็บตามเป้าหมาย &amp; พอร์ตลงทุน
                </span>
                <span className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                  รวม ฿{formatMoneyDisplay(goalWalletsTotal)}
                </span>
              </div>

              {goalWallets.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  <span>
                    ยังไม่มีกระเป๋าแยกสำหรับเก็บเป้าหมาย (เช่น พอร์ตหุ้น, ซื้อของให้แฟน, ของที่อยากได้)
                  </span>
                  {onOpenManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={onOpenManage}
                      className="h-7 text-xs"
                    >
                      สร้างกระเป๋าแยกเลย
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {goalWallets.map((wallet) => {
                    const bal = toDecimal(wallet.currentBalance);
                    const linkedAllocs =
                      linkedAllocationsByWalletId.get(wallet.id) ?? [];
                    const linkedNames = linkedAllocs.map((a) => a.name);

                    let progressPct: number | null = null;
                    let progressLabel: string | null = null;

                    if (linkedAllocs.length > 0) {
                      const targetTotals = linkedAllocs
                        .map((a) => a.targetTotal)
                        .filter((t): t is string =>
                          Boolean(t && toDecimal(t).gt(0))
                        );

                      if (targetTotals.length > 0) {
                        const totalTargetDec = sumMoney(targetTotals);
                        const pct = Math.min(
                          100,
                          Math.max(
                            0,
                            bal.div(totalTargetDec).times(100).toNumber()
                          )
                        );
                        const remainingDec = Decimal.max(
                          0,
                          totalTargetDec.minus(bal)
                        );
                        progressPct = pct;
                        progressLabel = bal.gte(totalTargetDec)
                          ? "🎉 เก็บครบเป้าหมายแล้ว!"
                          : `อีก ฿${formatMoneyDisplay(remainingDec)} ถึงเป้า ฿${formatMoneyDisplay(totalTargetDec)}`;
                      } else {
                        const monthlyTargetDec = sumMoney(
                          linkedAllocs.map((a) => a.monthlyAmount)
                        );
                        if (monthlyTargetDec.gt(0)) {
                          const transferredDec = sumMoney(
                            linkedAllocs.map((a) => a.transferredThisMonth)
                          );
                          const progressBase = transferredDec.gt(0)
                            ? transferredDec
                            : Decimal.min(
                                Decimal.max(0, bal),
                                monthlyTargetDec
                              );
                          const pct = Math.min(
                            100,
                            Math.max(
                              0,
                              progressBase
                                .div(monthlyTargetDec)
                                .times(100)
                                .toNumber()
                            )
                          );
                          progressPct = pct;
                          progressLabel = progressBase.gte(monthlyTargetDec)
                            ? `ครบเป้าเดือนนี้แล้ว (฿${formatMoneyDisplay(monthlyTargetDec)}/เดือน)`
                            : `เป้าเดือนนี้ ฿${formatMoneyDisplay(progressBase)} / ฿${formatMoneyDisplay(monthlyTargetDec)}`;
                        }
                      }
                    }

                    return (
                      <div
                        key={wallet.id}
                        className="flex flex-col justify-between gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: wallet.color ?? "#10b981",
                                }}
                              />
                              <p className="truncate font-medium">
                                {wallet.name}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {linkedNames.length > 0
                                ? `เป้าหมาย: ${linkedNames.join(", ")}`
                                : WALLET_TYPE_LABEL[wallet.type]}
                            </p>
                          </div>

                          <p className="shrink-0 font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                            ฿{formatMoneyDisplay(bal)}
                          </p>
                        </div>

                        {progressPct !== null && progressLabel ? (
                          <div className="space-y-1">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-950/10 dark:bg-emerald-100/10">
                              <div
                                className="animate-mf-progress h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                style={{
                                  width: `${progressPct}%`,
                                  backgroundColor: wallet.color ?? "#10b981",
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                              <span className="truncate text-muted-foreground">
                                {progressLabel}
                              </span>
                              <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-300">
                                {progressPct.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Credit Cards (only when active credit cards exist) */}
            {creditWallets.length > 0 ? (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-foreground">
                    💳 บัตรเครดิต
                  </span>
                  <span className="font-semibold text-amber-600 tabular-nums">
                    ยอดค้างชำระ ฿{formatMoneyDisplay(creditCardDebtTotal)}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {creditWallets.map((wallet) => {
                    const bal = toDecimal(wallet.currentBalance);
                    return (
                      <div
                        key={wallet.id}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: wallet.color ?? "#f59e0b",
                              }}
                            />
                            <p className="truncate font-medium">{wallet.name}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {WALLET_TYPE_LABEL[wallet.type]}
                            {bal.isNegative() ? " (ยอดค้างชำระ)" : ""}
                          </p>
                        </div>

                        <p
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            bal.isNegative() ? "text-amber-600" : "text-foreground"
                          )}
                        >
                          {bal.isNegative()
                            ? `฿${formatMoneyDisplay(bal.abs())}`
                            : `฿${formatMoneyDisplay(bal)}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
