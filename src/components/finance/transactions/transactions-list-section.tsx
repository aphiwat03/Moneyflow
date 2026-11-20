"use client";

import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIsoDateForDisplay } from "@/lib/date";
import { formatMoneyDisplay, sumMoney } from "@/lib/decimal";
import type { TransactionDTO, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_BADGE: Record<
  TransactionType,
  { label: string; className: string }
> = {
  income: {
    label: "รายรับ",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  expense: {
    label: "รายจ่าย",
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  transfer: {
    label: "โอนย้าย",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
};

interface TransactionsListSectionProps {
  filteredCount: number;
  paginatedRows: TransactionDTO[];
  viewMode: "list" | "daily";
  todayIso: string;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onChangePage: (nextPage: number) => void;
  onChangePageSize: (nextSize: number) => void;
  onEditTransaction: (tx: TransactionDTO) => void;
  onDeleteTransaction: (tx: TransactionDTO) => void;
}

export function TransactionsListSection({
  filteredCount,
  paginatedRows,
  viewMode,
  todayIso,
  currentPage,
  totalPages,
  pageSize,
  onChangePage,
  onChangePageSize,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionsListSectionProps) {
  const dailyGroups = useMemo(() => {
    if (viewMode !== "daily") return [];
    const groups = new Map<
      string,
      {
        date: string;
        items: TransactionDTO[];
        income: ReturnType<typeof sumMoney>;
        expense: ReturnType<typeof sumMoney>;
      }
    >();

    for (const tx of paginatedRows) {
      let group = groups.get(tx.transactionDate);
      if (!group) {
        group = {
          date: tx.transactionDate,
          items: [],
          income: sumMoney([]),
          expense: sumMoney([]),
        };
        groups.set(tx.transactionDate, group);
      }
      group.items.push(tx);
    }

    for (const group of groups.values()) {
      group.income = sumMoney(
        group.items.filter((t) => t.type === "income").map((t) => t.amount)
      );
      group.expense = sumMoney(
        group.items.filter((t) => t.type === "expense").map((t) => t.amount)
      );
    }

    return Array.from(groups.values());
  }, [paginatedRows, viewMode]);

  if (filteredCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {viewMode === "daily" ? (
        <div className="space-y-4">
          {dailyGroups.map((group) => {
            const isToday = group.date === todayIso;
            return (
              <Card key={group.date} className="gap-0 py-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3 text-xs">
                  <span className="font-semibold">
                    {isToday ? "วันนี้ • " : ""}
                    {formatIsoDateForDisplay(group.date)}
                  </span>
                  <div className="flex items-center gap-3 tabular-nums">
                    {group.income.gt(0) ? (
                      <span className="font-medium text-emerald-600">
                        รับ +฿{formatMoneyDisplay(group.income)}
                      </span>
                    ) : null}
                    {group.expense.gt(0) ? (
                      <span className="font-medium text-rose-600">
                        จ่าย -฿{formatMoneyDisplay(group.expense)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <CardContent className="divide-y p-0">
                  {group.items.map((tx) => {
                    const badge = TYPE_BADGE[tx.type];
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
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
                              <span className="text-sm font-medium">
                                {tx.type === "transfer"
                                  ? `${tx.walletName} → ${tx.toWalletName ?? "-"}`
                                  : (tx.categoryName ?? "ไม่ระบุหมวดหมู่")}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]", badge.className)}
                              >
                                {tx.walletName}
                              </Badge>
                            </div>
                            {tx.note ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {tx.note}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
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
                          <div className="flex items-center gap-1 max-lg:gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="max-lg:size-9"
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
                              className="text-destructive hover:text-destructive max-lg:size-9"
                              onClick={() => onDeleteTransaction(tx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <>
          {/* Mobile & iPad Portrait Card List */}
          <div className="space-y-2.5 lg:hidden">
            {paginatedRows.map((tx) => {
              const badge = TYPE_BADGE[tx.type];
              return (
                <Card key={tx.id}>
                  <CardContent className="flex items-start justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
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

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">
                            {tx.type === "transfer"
                              ? `${tx.walletName} → ${tx.toWalletName ?? "-"}`
                              : (tx.categoryName ?? "ไม่ระบุหมวดหมู่")}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", badge.className)}
                          >
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatIsoDateForDisplay(tx.transactionDate)} •{" "}
                          {tx.walletName}
                        </p>
                        {tx.note ? (
                          <p className="truncate text-xs text-foreground/80">
                            {tx.note}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p
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
                      </p>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-9"
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
                          className="ml-0.5 size-9 text-destructive hover:text-destructive"
                          onClick={() => onDeleteTransaction(tx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop & iPad Landscape Table */}
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">วันที่</TableHead>
                  <TableHead className="w-24">ประเภท</TableHead>
                  <TableHead>หมวดหมู่ / เส้นทางโอน</TableHead>
                  <TableHead>กระเป๋าเงิน</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead className="w-24 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((tx) => {
                  const badge = TYPE_BADGE[tx.type];
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {formatIsoDateForDisplay(tx.transactionDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.type === "transfer" ? (
                          <span>
                            {tx.walletName} → {tx.toWalletName ?? "-"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: tx.categoryColor ?? "#64748b",
                              }}
                            />
                            {tx.categoryName ?? "-"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{tx.walletName}</TableCell>
                      <TableCell className="max-w-60 truncate text-muted-foreground">
                        {tx.note ?? "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
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
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
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
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDeleteTransaction(tx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Pagination Footer */}
      {filteredCount > 10 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              แสดง {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredCount)} จากทั้งหมด{" "}
              <strong>{filteredCount}</strong> รายการ
            </span>
            <AppSelect
              ariaLabel="จำนวนรายการต่อหน้า"
              size="sm"
              value={String(pageSize)}
              onValueChange={(nextValue) => onChangePageSize(Number(nextValue))}
              className="w-28"
              options={[
                { value: "25", label: "25 / หน้า" },
                { value: "50", label: "50 / หน้า" },
                { value: "100", label: "100 / หน้า" },
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="max-lg:size-9"
              disabled={currentPage <= 1}
              onClick={() => onChangePage(Math.max(1, currentPage - 1))}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium tabular-nums">
              หน้า {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="max-lg:size-9"
              disabled={currentPage >= totalPages}
              onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
