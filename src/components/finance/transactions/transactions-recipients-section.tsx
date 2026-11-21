"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Building2,
  ChevronDown,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatIsoDateForDisplay,
  formatTransactionDateTimeDisplay,
} from "@/lib/date";
import { formatMoneyDisplay, sumMoney } from "@/lib/decimal";
import {
  buildRecipientLeaderboard,
  type RecipientSortMode,
} from "@/lib/recipient-summary";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TransactionsRecipientsSectionProps {
  transactions: TransactionDTO[];
  onEditTransaction: (tx: TransactionDTO) => void;
  onDeleteTransaction: (tx: TransactionDTO) => void;
}

export function TransactionsRecipientsSection({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionsRecipientsSectionProps) {
  const [sortBy, setSortBy] = useState<RecipientSortMode>("amount");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const groups = useMemo(
    () => buildRecipientLeaderboard(transactions, sortBy),
    [transactions, sortBy]
  );

  const grandTotal = useMemo(
    () => sumMoney(groups.map((g) => g.totalAmount)),
    [groups]
  );

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">
            ยังไม่มีข้อมูลผู้รับโอนในช่วงที่เลือก
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            ลองสแกนสลิปธนาคารเมื่อจดรายการใหม่ หรือกดขยายช่อง &ldquo;เพิ่มข้อมูลผู้รับโอน&rdquo;
            เพื่อเก็บสถิติว่าโอนให้ใครหรือบัญชีใดมากที่สุด
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Summary + Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground">
            ผู้รับโอนทั้งหมด{" "}
            <strong className="text-foreground tabular-nums">
              {groups.length}
            </strong>{" "}
            บัญชี/รายชื่อ
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            ยอดรวมที่มีผู้รับโอน{" "}
            <strong className="text-foreground tabular-nums">
              ฿{formatMoneyDisplay(grandTotal)}
            </strong>
          </span>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setSortBy("amount")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              sortBy === "amount"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDownUp className="h-3 w-3" />
            <span>ยอดเงินสูงสุด</span>
          </button>
          <button
            type="button"
            onClick={() => setSortBy("count")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              sortBy === "count"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>โอนบ่อยสุด</span>
          </button>
        </div>
      </div>

      {/* Ranked Leaderboard */}
      <div className="space-y-2.5">
        {groups.map((group, idx) => {
          const rank = idx + 1;
          const isTop3 = rank <= 3;
          const isExpanded = expandedKey === group.key;

          return (
            <Card key={group.key} className="gap-0 overflow-hidden py-0">
              <button
                type="button"
                onClick={() =>
                  setExpandedKey((prev) =>
                    prev === group.key ? null : group.key
                  )
                }
                aria-expanded={isExpanded}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                        rank === 1
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : isTop3
                            ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      #{rank}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">
                          {group.recipientName}
                        </span>
                        {group.recipientBank ? (
                          <Badge
                            variant="outline"
                            className="inline-flex items-center gap-1 border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-300"
                          >
                            <Building2 className="h-2.5 w-2.5" />
                            <span>{group.recipientBank}</span>
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                        {group.recipientAccount ? (
                          <span className="font-mono text-[11px] tabular-nums">
                            {group.recipientAccount}
                          </span>
                        ) : null}
                        <span>ล่าสุด {formatIsoDateForDisplay(group.lastDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        ฿{formatMoneyDisplay(group.totalAmount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {group.transferCount} ครั้ง
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {/* Relative weight progress bar */}
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      rank === 1 ? "bg-amber-500" : "bg-teal-600"
                    )}
                    style={{ width: `${Math.max(4, group.shareOfMaxPct)}%` }}
                  />
                </div>
              </button>

              {isExpanded ? (
                <div className="divide-y border-t bg-muted/15">
                  {group.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-muted-foreground tabular-nums">
                            {formatTransactionDateTimeDisplay(tx)}
                          </span>
                          <span>•</span>
                          <span className="font-medium">
                            {tx.type === "transfer"
                              ? `${tx.walletName} → ${tx.toWalletName ?? "-"}`
                              : `${tx.categoryName ?? "ไม่ระบุหมวดหมู่"} (${tx.walletName})`}
                          </span>
                        </div>
                        {tx.note ? (
                          <p className="truncate text-muted-foreground">
                            {tx.note}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
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
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 max-lg:size-8"
                          aria-label="แก้ไขรายการ"
                          onClick={() => onEditTransaction(tx)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="ลบรายการ"
                          className="h-7 w-7 text-destructive hover:text-destructive max-lg:size-8"
                          onClick={() => onDeleteTransaction(tx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
