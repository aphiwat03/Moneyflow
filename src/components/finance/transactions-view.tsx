"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Plus, Upload } from "lucide-react";
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
import { filterTransactionsList } from "@/lib/dashboard-analytics";
import { getBangkokToday } from "@/lib/date";
import { formatMoneyDisplay } from "@/lib/decimal";
import type {
  ActionResult,
  CategoryDTO,
  TransactionDTO,
  TransactionFilterParams,
  WalletDTO,
} from "@/lib/types";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { CsvImportDialog } from "./transactions/csv-import-dialog";
import { TransactionsFilterBar } from "./transactions/transactions-filter-bar";
import { TransactionsListSection } from "./transactions/transactions-list-section";
import { TransactionsRecipientsSection } from "./transactions/transactions-recipients-section";

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

  const [viewMode, setViewMode] = useState<"list" | "daily" | "recipients">(
    "daily"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(initialOpenAdd);
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null);
  const [deletingTx, setDeletingTx] = useState<TransactionDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

  function updateFilters(
    updater: (prev: TransactionFilterParams) => TransactionFilterParams
  ) {
    setFilters(updater);
    setPage(1);
  }

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
                setActionError(null);
                setActionSuccess(null);
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
      <TransactionsFilterBar
        filters={filters}
        wallets={wallets}
        categories={categories}
        viewMode={viewMode}
        filteredCount={filtered.length}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
        onChangeViewMode={setViewMode}
      />

      {/* Transactions List / Daily View / Recipients Leaderboard */}
      {viewMode === "recipients" ? (
        <TransactionsRecipientsSection
          transactions={filtered}
          onEditTransaction={(tx) => {
            setEditingTx(tx);
            setFormOpen(true);
          }}
          onDeleteTransaction={(tx) => setDeletingTx(tx)}
        />
      ) : (
        <TransactionsListSection
          filteredCount={filtered.length}
          paginatedRows={paginatedRows}
          viewMode={viewMode}
          todayIso={todayIso}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onChangePage={setPage}
          onChangePageSize={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
          onEditTransaction={(tx) => {
            setEditingTx(tx);
            setFormOpen(true);
          }}
          onDeleteTransaction={(tx) => setDeletingTx(tx)}
        />
      )}

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        wallets={wallets}
        categories={categories}
        onImportTransactions={onImportTransactions}
        onImportSuccess={(msg) => {
          setActionError(null);
          setActionSuccess(msg);
        }}
      />

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
