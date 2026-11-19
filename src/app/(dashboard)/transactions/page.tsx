import type { Metadata } from "next";
import { Suspense } from "react";
import { DatabaseConnectionWarning } from "@/components/finance/db-connection-warning";
import { DbTransactionsClient } from "@/components/finance/db-transactions-client";
import {
  getUserCategories,
  getUserTransactions,
  getUserWalletsWithBalances,
} from "@/lib/finance-queries";
import { requireUser } from "@/lib/session";
import type { CategoryDTO, TransactionDTO, WalletDTO } from "@/lib/types";

export const metadata: Metadata = {
  title: "ประวัติรายการ",
};

async function TransactionsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const initialOpenAdd = sp.add === "1";

  let data: {
    txList: TransactionDTO[];
    walletList: WalletDTO[];
    categoryList: CategoryDTO[];
  } | null = null;

  try {
    const [txList, walletList, categoryList] = await Promise.all([
      getUserTransactions(user.id),
      getUserWalletsWithBalances(user.id),
      getUserCategories(user.id),
    ]);
    data = { txList, walletList, categoryList };
  } catch (error) {
    console.error("Transactions database query error:", error);
  }

  if (!data) {
    return <DatabaseConnectionWarning />;
  }

  return (
    <DbTransactionsClient
      transactions={data.txList}
      wallets={data.walletList}
      categories={data.categoryList}
      initialOpenAdd={initialOpenAdd}
    />
  );
}

export default function TransactionsPage(props: PageProps<"/transactions">) {
  return (
    <Suspense
      fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}
    >
      <TransactionsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
