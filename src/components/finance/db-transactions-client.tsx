"use client";

import {
  bulkImportTransactionsAction,
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
  type TransactionFormInput,
} from "@/actions/transactions";
import { useServerRefresh } from "@/lib/use-server-refresh";
import type {
  ActionResult,
  CategoryDTO,
  TransactionDTO,
  TransactionFilterParams,
  WalletDTO,
} from "@/lib/types";
import { TransactionsView } from "./transactions-view";

export function DbTransactionsClient({
  transactions,
  wallets,
  categories,
  initialOpenAdd = false,
}: {
  transactions: TransactionDTO[];
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  initialOpenAdd?: boolean;
}) {
  const { refreshAsync } = useServerRefresh();

  async function handleSaveTransaction(
    values: TransactionFormInput,
    editingId?: string
  ): Promise<ActionResult<unknown>> {
    const res = editingId
      ? await updateTransactionAction(editingId, values)
      : await createTransactionAction(values);
    if (res.ok) {
      await refreshAsync();
    }
    return res;
  }

  async function handleDeleteTransaction(
    transactionId: string
  ): Promise<ActionResult<unknown>> {
    const res = await deleteTransactionAction(transactionId);
    if (res.ok) {
      await refreshAsync();
    }
    return res;
  }

  async function handleExportExcel(filters: TransactionFilterParams) {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== "all") params.set("type", filters.type);
    if (filters.walletId && filters.walletId !== "all") {
      params.set("walletId", filters.walletId);
    }
    if (filters.categoryId && filters.categoryId !== "all") {
      params.set("categoryId", filters.categoryId);
    }
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.q?.trim()) params.set("q", filters.q.trim());

    const queryString = params.toString();
    const url = queryString ? `/api/export?${queryString}` : "/api/export";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Export failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    const disposition = response.headers.get("Content-Disposition");
    const match = disposition?.match(/filename="([^"]+)"/);
    link.download = match?.[1] ?? "MoneyFlow.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleImportTransactions(rows: TransactionFormInput[]) {
    const res = await bulkImportTransactionsAction(rows);
    if (res.ok) {
      await refreshAsync();
    }
    return res;
  }

  return (
    <TransactionsView
      transactions={transactions}
      wallets={wallets}
      categories={categories}
      initialOpenAdd={initialOpenAdd}
      onSaveTransaction={handleSaveTransaction}
      onDeleteTransaction={handleDeleteTransaction}
      onExportExcel={handleExportExcel}
      onImportTransactions={handleImportTransactions}
    />
  );
}
