"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Target,
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
import { formatTransactionDateTimeDisplay } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import type { DashboardAnalytics, TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const RECENT_TRANSACTIONS_PAGE_SIZE = 10;

interface DashboardBudgetsRecentProps {
  budgetStatuses: DashboardAnalytics["budgetStatuses"];
  recentTransactions: TransactionDTO[];
  selectedMonthKey: string;
  monthLabel: string;
  onEditTransaction: (tx: TransactionDTO) => void;
  onViewAllTransactions: () => void;
}

export function DashboardBudgetsRecent({
  budgetStatuses,
  recentTransactions,
  selectedMonthKey,
  monthLabel,
  onEditTransaction,
  onViewAllTransactions,
}: DashboardBudgetsRecentProps) {
  const [recentPageState, setRecentPageState] = useState<{
    monthKey: string;
    page: number;
  }>({ monthKey: selectedMonthKey, page: 1 });

  const totalRecentCount = recentTransactions.length;
  const recentTotalPages = Math.max(
    1,
    Math.ceil(totalRecentCount / RECENT_TRANSACTIONS_PAGE_SIZE)
  );
  const rawRecentPage =
    recentPageState.monthKey === selectedMonthKey ? recentPageState.page : 1;
  const recentCurrentPage = Math.min(rawRecentPage, recentTotalPages);
  const recentStartIndex =
    (recentCurrentPage - 1) * RECENT_TRANSACTIONS_PAGE_SIZE;
  const paginatedRecentTransactions = recentTransactions.slice(
    recentStartIndex,
    recentStartIndex + RECENT_TRANSACTIONS_PAGE_SIZE
  );

  return (
    <>
      {/* Monthly Budgets Progress */}
      {budgetStatuses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-teal-600" />
              <span>งบประมาณรายเดือน ({monthLabel})</span>
            </CardTitle>
            <CardDescription>
              ติดตามการใช้จ่ายเทียบกับเพดานงบที่ตั้งไว้ในแต่ละหมวดหมู่
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {budgetStatuses.map((b) => {
                const barWidth = Math.min(100, Math.max(0, b.percentage));
                const remainingDec = toDecimal(b.remaining);
                return (
                  <div
                    key={b.categoryId}
                    className="space-y-2 rounded-xl border bg-background p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="truncate text-sm font-medium">
                          {b.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
                          b.isOverBudget
                            ? "text-rose-600"
                            : b.isNearLimit
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        )}
                      >
                        {b.isOverBudget || b.isNearLimit ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : null}
                        {b.percentage.toFixed(0)}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          b.isOverBudget
                            ? "bg-rose-600"
                            : b.isNearLimit
                              ? "bg-amber-500"
                              : "bg-teal-600"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                      <span>
                        ใช้ไป ฿{formatMoneyDisplay(b.spent)} / ฿
                        {formatMoneyDisplay(b.budget)}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          b.isOverBudget ? "text-rose-600" : "text-emerald-600"
                        )}
                      >
                        {b.isOverBudget
                          ? `เกินงบ ฿${formatMoneyDisplay(remainingDec.abs())}`
                          : `คงเหลือ ฿${formatMoneyDisplay(remainingDec)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              รายการเคลื่อนไหวล่าสุด ({monthLabel})
            </CardTitle>
            <CardDescription>
              คลิกที่รายการเพื่อแก้ไข หรือดูรายการทั้งหมดพร้อมตัวกรองและ Export
              Excel
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewAllTransactions}
            className="shrink-0"
          >
            ดูทั้งหมด
          </Button>
        </CardHeader>
        <CardContent>
          {totalRecentCount === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการในเดือนนี้ กดปุ่ม &ldquo;+ จดรายการด่วน&rdquo;
              เพื่อเริ่มบันทึก
            </div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y">
                {paginatedRecentTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onEditTransaction(tx)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/40 sm:rounded-lg sm:px-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          tx.type === "income"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : tx.type === "expense"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-sky-500/10 text-sky-600"
                        )}
                      >
                        {tx.type === "income" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : tx.type === "expense" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowLeftRight className="h-4 w-4" />
                        )}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium">
                            {tx.type === "transfer"
                              ? `${tx.walletName} → ${tx.toWalletName ?? "-"}`
                              : (tx.categoryName ?? "ไม่ระบุหมวดหมู่")}
                          </p>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-normal"
                          >
                            {tx.walletName}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground tabular-nums">
                          {formatTransactionDateTimeDisplay(tx)}
                          {tx.note ? ` • ${tx.note}` : ""}
                        </p>
                      </div>
                    </div>

                    <p
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        tx.type === "income"
                          ? "text-emerald-600"
                          : tx.type === "expense"
                            ? "text-rose-600"
                            : "text-sky-600"
                      )}
                    >
                      {tx.type === "income"
                        ? "+"
                        : tx.type === "expense"
                          ? "-"
                          : ""}
                      ฿{formatMoneyDisplay(tx.amount)}
                    </p>
                  </button>
                ))}
              </div>

              {totalRecentCount > RECENT_TRANSACTIONS_PAGE_SIZE ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    แสดง {recentStartIndex + 1}–
                    {Math.min(
                      recentStartIndex + RECENT_TRANSACTIONS_PAGE_SIZE,
                      totalRecentCount
                    )}{" "}
                    จากทั้งหมด <strong>{totalRecentCount}</strong> รายการ
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="max-lg:size-9"
                      disabled={recentCurrentPage <= 1}
                      onClick={() =>
                        setRecentPageState({
                          monthKey: selectedMonthKey,
                          page: Math.max(1, recentCurrentPage - 1),
                        })
                      }
                      aria-label="หน้าก่อนหน้า"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-medium tabular-nums">
                      หน้า {recentCurrentPage} / {recentTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="max-lg:size-9"
                      disabled={recentCurrentPage >= recentTotalPages}
                      onClick={() =>
                        setRecentPageState({
                          monthKey: selectedMonthKey,
                          page: Math.min(
                            recentTotalPages,
                            recentCurrentPage + 1
                          ),
                        })
                      }
                      aria-label="หน้าถัดไป"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
