"use client";

import { useState } from "react";
import type { SalarySettingsFormInput } from "@/actions/salary-plan";
import { Button } from "@/components/ui/button";
import type { MoneyFlowBackupBundle } from "@/lib/portable-backup";
import type {
  ActionResult,
  CategoryDTO,
  CategoryType,
  SalarySettingsDTO,
  WalletDTO,
  WalletType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ManageAccountCards } from "./manage/manage-account-cards";
import { ManageBackupCard } from "./manage/manage-backup-card";
import { ManageCategoriesSection } from "./manage/manage-categories-section";
import { ManageSalaryCard } from "./manage/manage-salary-card";
import {
  ManageWalletsSection,
  type ManageNotice,
} from "./manage/manage-wallets-section";

interface ManageViewProps {
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  salarySettings?: SalarySettingsDTO | null;
  userProfile?: {
    name: string | null;
    email: string;
  } | null;
  onSaveSalarySettings?: (
    input: SalarySettingsFormInput
  ) => Promise<ActionResult<unknown>>;
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
  onCreateCategory: (input: {
    name: string;
    type: CategoryType;
    monthlyBudget?: string | null;
    color?: string | null;
  }) => Promise<ActionResult<unknown>>;
  onUpdateCategory: (
    categoryId: string,
    input: {
      name: string;
      type: CategoryType;
      monthlyBudget?: string | null;
      color?: string | null;
    }
  ) => Promise<ActionResult<unknown>>;
  onToggleArchiveCategory: (
    categoryId: string,
    isArchived: boolean
  ) => Promise<ActionResult<unknown>>;
  onDeleteCategory?: (categoryId: string) => Promise<ActionResult<unknown>>;
  onUpdateProfile?: (input: {
    name: string;
  }) => Promise<ActionResult<{ name: string }>>;
  onChangePassword?: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<ActionResult<unknown>>;
  onExportFullBackup?: () => Promise<ActionResult<MoneyFlowBackupBundle>>;
  onRestoreFullBackup?: (
    bundle: MoneyFlowBackupBundle
  ) => Promise<
    ActionResult<{
      walletsCount: number;
      categoriesCount: number;
      transactionsCount: number;
      allocationsCount: number;
    }>
  >;
}

export function ManageView({
  wallets,
  categories,
  salarySettings,
  userProfile,
  onSaveSalarySettings,
  onCreateWallet,
  onUpdateWallet,
  onToggleArchiveWallet,
  onDeleteWallet,
  onAdjustWalletBalance,
  onCreateCategory,
  onUpdateCategory,
  onToggleArchiveCategory,
  onDeleteCategory,
  onUpdateProfile,
  onChangePassword,
  onExportFullBackup,
  onRestoreFullBackup,
}: ManageViewProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<ManageNotice | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            กระเป๋าเงิน หมวดหมู่ และบัญชีผู้ใช้
          </h1>
          <p className="text-sm text-muted-foreground">
            ปรับยอดคงเหลือ ตั้งงบประมาณรายเดือน ซ่อน (Archive) หรือลบรายการที่ไม่ใช้แล้ว
          </p>
        </div>

        <Button
          type="button"
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived((s) => !s)}
        >
          {showArchived ? "ซ่อนรายการที่ Archive ไว้" : "แสดงรายการที่ Archive"}
        </Button>
      </div>

      {globalNotice ? (
        <div
          role={globalNotice.type === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            globalNotice.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          )}
        >
          {globalNotice.message}
        </div>
      ) : null}

      <ManageWalletsSection
        wallets={wallets}
        showArchived={showArchived}
        onCreateWallet={onCreateWallet}
        onUpdateWallet={onUpdateWallet}
        onToggleArchiveWallet={onToggleArchiveWallet}
        onDeleteWallet={onDeleteWallet}
        onAdjustWalletBalance={onAdjustWalletBalance}
        onNotify={setGlobalNotice}
      />

      <ManageCategoriesSection
        categories={categories}
        showArchived={showArchived}
        onCreateCategory={onCreateCategory}
        onUpdateCategory={onUpdateCategory}
        onToggleArchiveCategory={onToggleArchiveCategory}
        onDeleteCategory={onDeleteCategory}
        onNotify={setGlobalNotice}
      />

      {onSaveSalarySettings ? (
        <ManageSalaryCard
          wallets={wallets}
          salarySettings={salarySettings}
          onSaveSalarySettings={onSaveSalarySettings}
          onNotify={setGlobalNotice}
        />
      ) : null}

      {onExportFullBackup || onRestoreFullBackup ? (
        <ManageBackupCard
          onExportFullBackup={onExportFullBackup}
          onRestoreFullBackup={onRestoreFullBackup}
          onNotify={setGlobalNotice}
        />
      ) : null}

      {userProfile && (onUpdateProfile || onChangePassword) ? (
        <ManageAccountCards
          userProfile={userProfile}
          onUpdateProfile={onUpdateProfile}
          onChangePassword={onChangePassword}
          onNotify={setGlobalNotice}
        />
      ) : null}
    </div>
  );
}
