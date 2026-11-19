import type { Metadata } from "next";
import { Suspense } from "react";
import { DatabaseConnectionWarning } from "@/components/finance/db-connection-warning";
import { DbManageClient } from "@/components/finance/db-manage-client";
import {
  getUserCategories,
  getUserSalaryConfig,
  getUserWalletsWithBalances,
} from "@/lib/finance-queries";
import { requireUser } from "@/lib/session";
import type { CategoryDTO, SalarySettingsDTO, WalletDTO } from "@/lib/types";

export const metadata: Metadata = {
  title: "จัดการกระเป๋าและหมวดหมู่",
};

async function ManageContent() {
  const user = await requireUser();

  let data: {
    walletList: WalletDTO[];
    categoryList: CategoryDTO[];
    salarySettings: SalarySettingsDTO | null;
  } | null = null;

  try {
    const [walletList, categoryList, salaryConfig] = await Promise.all([
      getUserWalletsWithBalances(user.id),
      getUserCategories(user.id),
      getUserSalaryConfig(user.id),
    ]);
    data = {
      walletList,
      categoryList,
      salarySettings: salaryConfig.settings,
    };
  } catch (error) {
    console.error("Manage database query error:", error);
  }

  if (!data) {
    return <DatabaseConnectionWarning />;
  }

  return (
    <DbManageClient
      wallets={data.walletList}
      categories={data.categoryList}
      salarySettings={data.salarySettings}
      userProfile={{
        name: user.name ?? null,
        email: user.email,
      }}
    />
  );
}

export default function ManagePage() {
  return (
    <Suspense
      fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}
    >
      <ManageContent />
    </Suspense>
  );
}
