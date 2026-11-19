"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { TransactionFormInput } from "@/actions/transactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  parseCsvTransactions,
  SAMPLE_CSV_TEMPLATE,
  type CsvImportCandidate,
} from "@/lib/csv-import";
import { filterTransactionsList } from "@/lib/dashboard-analytics";
import { formatIsoDateForDisplay, getBangkokToday } from "@/lib/date";
import { formatMoneyDisplay, sumMoney } from "@/lib/decimal";
import type {
  ActionResult,
  CategoryDTO,
  TransactionDTO,
  TransactionFilterParams,
  TransactionType,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { TransactionFormDialog } from "./transaction-form-dialog";

interface TransactionsViewProps {
  transactions: TransactionDTO[];
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  initialOpenAdd?: boolean;
  onSaveTransaction: (
    values: TransactionFormInput,
    editingId?: string
  ) => Promise<ActionResult<unknown>>;
  onDeleteTransaction: (transactionId: string) => Promise<ActionResult<unknown>>;
  onExportExcel: (
    filters: TransactionFilterParams,
    filteredRows: TransactionDTO[]
  ) => Promise<void> | void;
  onImportTransactions?: (
    rows: TransactionFormInput[]
  ) => Promise<ActionResult<{ importedCount: number }>>;
}

const TYPE_BADGE: Record<
  TransactionType,
  { label: string; className: string }
> = {
  income: {
    label: "รายรับ",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  expense: {
    label: "รายจ่าย",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  transfer: {
    label: "โอนย้าย",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
};

export function TransactionsView({
  transactions,
  wallets,
  categories,
  initialOpenAdd = false,
  onSaveTransaction,
  onDeleteTransaction,
  onExportExcel,
  onImportTransactions,
}: TransactionsViewProps) {
  const [filters, setFilters] = useState<TransactionFilterParams>({
    q: "",
    type: "all",
    walletId: "all",
    categoryId: "all",
    startDate: "",
    endDate: "",
  });

  const [viewMode, setViewMode] = useState<"list" | "daily">("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(initialOpenAdd);
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null);
  const [deletingTx, setDeletingTx] = useState<TransactionDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // CSV Import state
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importCandidates = useMemo<CsvImportCandidate[]>(() => {
    if (!csvText.trim()) return [];
    return parseCsvTransactions(csvText, wallets, categories);
  }, [csvText, wallets, categories]);

  const validImportPayloads = useMemo(() => {
    return importCandidates
      .filter((c) => c.valid && c.payload)
      .map((c) => c.payload!);
  }, [importCandidates]);

  const filtered = useMemo(() => {
    return filterTransactionsList(transactions, filters).sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate)
    );
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const todayIso = useMemo(() => getBangkokToday(), []);

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

  function updateFilters(
    updater: (prev: TransactionFilterParams) => TransactionFilterParams
  ) {
    setFilters(updater);
    setPage(1);
  }

  const summary = useMemo(() => {
    const income = sumMoney(
      filtered.filter((t) => t.type === "income").map((t) => t.amount)
    );
    const expense = sumMoney(
      filtered.filter((t) => t.type === "expense").map((t) => t.amount)
    );
    return {
      income,
      expense,
      net: income.minus(expense),
    };
  }, [filtered]);

  function resetFilters() {
    setFilters({
      q: "",
      type: "all",
      walletId: "all",
      categoryId: "all",
      startDate: "",
      endDate: "",
    });
    setPage(1);
  }

  async function handleConfirmDelete() {
    if (!deletingTx) return;
    setIsDeleting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await onDeleteTransaction(deletingTx.id);
      if (!result.ok) {
        setActionError(result.error ?? "ลบรายการไม่สำเร็จ");
      } else {
        setDeletingTx(null);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleExportClick() {
    setIsExporting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onExportExcel(filters, filtered);
    } catch {
      setActionError("ไม่สามารถสร้างไฟล์ Excel ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExporting(false);
    }
  }

  function handleDownloadCsvTemplate() {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MoneyFlow_Import_Template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      setCsvText(text);
    } catch {
      setImportError("ไม่สามารถอ่านไฟล์ CSV ได้");
    }
  }

  async function handleConfirmImport() {
    if (!onImportTransactions || validImportPayloads.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await onImportTransactions(validImportPayloads);
      if (!res.ok) {
        setImportError(res.error ?? "นำเข้ารายการไม่สำเร็จ");
        return;
      }
      setImportOpen(false);
      setCsvText("");
      setActionSuccess(
        `นำเข้าข้อมูลสำเร็จ ${res.data?.importedCount ?? validImportPayloads.length} รายการ`
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ประวัติรายการ</h1>
          <p className="text-sm text-muted-foreground">
            ค้นหา กรองรายการ แก้ไข นำเข้า CSV และส่งออกไฟล์ Excel (.xlsx)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onImportTransactions ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportError(null);
                setImportOpen(true);
              }}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4 text-teal-600" />
              <span>Import CSV</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={handleExportClick}
            disabled={isExporting || filtered.length === 0}
            className="gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{isExporting ? "กำลังสร้างไฟล์..." : "Export .xlsx"}</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setFormOpen(true);
            }}
            className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            <span>จดรายการใหม่</span>
          </Button>
        </div>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      ) : null}

      {actionSuccess ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {actionSuccess}
        </div>
      ) : null}

      {/* Filter Bar */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative sm:col-span-2 lg:col-span-4">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="ค้นหาหมายเหตุ, หมวดหมู่, กระเป๋า..."
                value={filters.q ?? ""}
                onChange={(e) =>
                  updateFilters((f) => ({ ...f, q: e.target.value }))
                }
                className="h-10 pl-9 lg:h-9"
              />
            </div>

            <div className="lg:col-span-2">
              <AppSelect
                ariaLabel="กรองตามประเภท"
                value={filters.type ?? "all"}
                onValueChange={(nextValue) =>
                  updateFilters((f) => ({
                    ...f,
                    type: nextValue as TransactionType | "all",
                  }))
                }
                className="lg:h-9"
                options={[
                  { value: "all", label: "ทุกประเภท" },
                  { value: "expense", label: "รายจ่าย", dotColor: "#e11d48" },
                  { value: "income", label: "รายรับ", dotColor: "#10b981" },
                  { value: "transfer", label: "โอนย้าย", dotColor: "#0284c7" },
                ]}
              />
            </div>

            <div className="lg:col-span-3">
              <AppSelect
                ariaLabel="กรองตามกระเป๋าเงิน"
                value={filters.walletId ?? "all"}
                onValueChange={(nextValue) =>
                  updateFilters((f) => ({ ...f, walletId: nextValue }))
                }
                className="lg:h-9"
                options={[
                  { value: "all", label: "ทุกกระเป๋าเงิน" },
                  ...wallets.map((w) => ({
                    value: w.id,
                    label: w.name,
                    dotColor: w.color ?? "#0f766e",
                    badge: w.isArchived ? "ซ่อนอยู่" : null,
                  })),
                ]}
              />
            </div>

            <div className="lg:col-span-3">
              <AppSelect
                ariaLabel="กรองตามหมวดหมู่"
                value={filters.categoryId ?? "all"}
                onValueChange={(nextValue) =>
                  updateFilters((f) => ({ ...f, categoryId: nextValue }))
                }
                className="lg:h-9"
                options={[
                  { value: "all", label: "ทุกหมวดหมู่" },
                  ...categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    dotColor: c.color ?? "#64748b",
                    badge: c.type === "income" ? "รายรับ" : "รายจ่าย",
                  })),
                ]}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2">
                <Input
                  type="date"
                  aria-label="ตั้งแต่วันที่"
                  value={filters.startDate ?? ""}
                  onChange={(e) =>
                    updateFilters((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="h-10 w-full px-2 text-base sm:w-auto lg:h-8 lg:px-2.5 lg:text-xs"
                />
                <span className="text-xs text-muted-foreground">ถึง</span>
                <Input
                  type="date"
                  aria-label="ถึงวันที่"
                  value={filters.endDate ?? ""}
                  onChange={(e) =>
                    updateFilters((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="h-10 w-full px-2 text-base sm:w-auto lg:h-8 lg:px-2.5 lg:text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>ล้างตัวกรอง</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>ตารางรวม</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("daily")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === "daily"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>จัดกลุ่มรายวัน</span>
                </button>
              </div>
              <span className="text-muted-foreground">
                พบ <strong>{filtered.length}</strong> รายการ
              </span>
              <span className="text-emerald-600 tabular-nums">
                รับ +฿{formatMoneyDisplay(summary.income)}
              </span>
              <span className="text-rose-600 tabular-nums">
                จ่าย -฿{formatMoneyDisplay(summary.expense)}
              </span>
              <span className="font-semibold tabular-nums">
                สุทธิ {summary.net.gte(0) ? "+" : "-"}฿
                {formatMoneyDisplay(summary.net.abs())}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === "daily" ? (
            <div className="space-y-4">
              {dailyGroups.map((group) => {
                const isToday = group.date === todayIso;
                return (
                  <Card key={group.date}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-xs">
                      <span className="font-semibold">
                        {isToday ? "วันนี้ • " : ""}
                        {formatIsoDateForDisplay(group.date)}
                      </span>
                      <div className="flex items-center gap-3 tabular-nums">
                        {group.income.gt(0) ? (
                          <span className="text-emerald-600 font-medium">
                            รับ +฿{formatMoneyDisplay(group.income)}
                          </span>
                        ) : null}
                        {group.expense.gt(0) ? (
                          <span className="text-rose-600 font-medium">
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
                                  <span className="font-medium text-sm">
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
                                  "font-semibold tabular-nums text-sm",
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
                                  onClick={() => {
                                    setEditingTx(tx);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="ลบรายการ"
                                  className="max-lg:size-9 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingTx(tx)}
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
                          onClick={() => {
                            setEditingTx(tx);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="ลบรายการ"
                          className="ml-0.5 size-9 text-destructive hover:text-destructive"
                          onClick={() => setDeletingTx(tx)}
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
                            onClick={() => {
                              setEditingTx(tx);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบรายการ"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingTx(tx)}
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
          {filtered.length > 10 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  แสดง {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, filtered.length)} จากทั้งหมด{" "}
                  <strong>{filtered.length}</strong> รายการ
                </span>
                <AppSelect
                  ariaLabel="จำนวนรายการต่อหน้า"
                  size="sm"
                  value={String(pageSize)}
                  onValueChange={(nextValue) => {
                    setPageSize(Number(nextValue));
                    setPage(1);
                  }}
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="หน้าถัดไป"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>นำเข้ารายการจากไฟล์ CSV (Import CSV)</DialogTitle>
            <DialogDescription>
              เลือกไฟล์ `.csv` หรือวางข้อความตารางเพื่อนำเข้ารายรับ-รายจ่ายหลายรายการพร้อมกัน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {importError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {importError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">
                รองรับรูปแบบคอลัมน์มาตรฐานของ MoneyFlow หรือ `วันที่,ประเภท,จำนวนเงิน,กระเป๋า,หมวดหมู่,หมายเหตุ`
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadCsvTemplate}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>ดาวน์โหลดไฟล์ตัวอย่าง .csv</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                เลือกไฟล์ .csv จากเครื่อง
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCsvText(SAMPLE_CSV_TEMPLATE)}
              >
                วางข้อมูลตัวอย่างเพื่อทดสอบ
              </Button>
            </div>

            <div className="space-y-1.5">
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="วันที่,ประเภท,หมวดหมู่,จากกระเป๋า,ไปยังกระเป๋า,รายละเอียด/หมายเหตุ,จำนวนเงิน"
                className="w-full rounded-lg border border-input bg-background p-2.5 font-mono text-base outline-none focus-visible:border-ring lg:text-xs"
              />
            </div>

            {importCandidates.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    ตรวจสอบข้อมูลก่อนนำเข้า ({validImportPayloads.length} /{" "}
                    {importCandidates.length} รายการพร้อมบันทึก)
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border text-xs">
                  <div className="divide-y">
                    {importCandidates.slice(0, 50).map((c) => (
                      <div
                        key={c.rowNumber}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <div className="min-w-0 truncate">
                          <span className="text-muted-foreground">
                            #{c.rowNumber}
                          </span>{" "}
                          <span className="font-medium">{c.rawDate}</span> •{" "}
                          <span>{c.rawCategory || c.rawType}</span> (
                          {c.rawWallet})
                        </div>
                        <div className="shrink-0">
                          {c.valid ? (
                            <span className="font-semibold text-emerald-600 tabular-nums">
                              ฿{c.rawAmount}
                            </span>
                          ) : (
                            <span className="text-destructive">{c.error}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              disabled={isImporting || validImportPayloads.length === 0}
              onClick={handleConfirmImport}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              {isImporting
                ? "กำลังนำเข้า..."
                : `นำเข้า ${validImportPayloads.length} รายการ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        wallets={wallets}
        categories={categories}
        initialTransaction={editingTx}
        onSubmit={onSaveTransaction}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingTx)}
        onOpenChange={(open) => {
          if (!open) setDeletingTx(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรายการ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบรายการยอด ฿
              {deletingTx ? formatMoneyDisplay(deletingTx.amount) : "0.00"}{" "}
              ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingTx(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting ? "กำลังลบ..." : "ลบรายการ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
