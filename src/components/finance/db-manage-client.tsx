"use client";

import { useRouter } from "next/navigation";
import { changePasswordAction, updateProfileAction } from "@/actions/auth";
import { exportUserBackupAction, restoreUserBackupAction } from "@/actions/backup";
import {
  createCategoryAction,
  deleteCategoryAction,
  toggleArchiveCategoryAction,
  updateCategoryAction,
} from "@/actions/categories";
import {
  adjustWalletBalanceAction,
  createWalletAction,
  deleteWalletAction,
  toggleArchiveWalletAction,
  updateWalletAction,
} from "@/actions/wallets";
import { saveSalarySettingsAction } from "@/actions/salary-plan";
import type { CategoryDTO, SalarySettingsDTO, WalletDTO } from "@/lib/types";
import { ManageView } from "./manage-view";

export function DbManageClient({
  wallets,
  categories,
  salarySettings,
  userProfile,
}: {
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  salarySettings: SalarySettingsDTO | null;
  userProfile: {
    name: string | null;
    email: string;
  };
}) {
  const router = useRouter();

  return (
    <ManageView
      wallets={wallets}
      categories={categories}
      salarySettings={salarySettings}
      userProfile={userProfile}
      onSaveSalarySettings={async (input) => {
        const res = await saveSalarySettingsAction(input);
        if (res.ok) router.refresh();
        return res;
      }}
      onCreateWallet={async (input) => {
        const res = await createWalletAction(input);
        if (res.ok) router.refresh();
        return res;
      }}
      onUpdateWallet={async (id, input) => {
        const res = await updateWalletAction(id, input);
        if (res.ok) router.refresh();
        return res;
      }}
      onToggleArchiveWallet={async (id, isArchived) => {
        const res = await toggleArchiveWalletAction(id, isArchived);
        if (res.ok) router.refresh();
        return res;
      }}
      onDeleteWallet={async (id) => {
        const res = await deleteWalletAction(id);
        if (res.ok) router.refresh();
        return res;
      }}
      onAdjustWalletBalance={async (input) => {
        const res = await adjustWalletBalanceAction(input);
        if (res.ok) router.refresh();
        return res;
      }}
      onCreateCategory={async (input) => {
        const res = await createCategoryAction(input);
        if (res.ok) router.refresh();
        return res;
      }}
      onUpdateCategory={async (id, input) => {
        const res = await updateCategoryAction(id, input);
        if (res.ok) router.refresh();
        return res;
      }}
      onToggleArchiveCategory={async (id, isArchived) => {
        const res = await toggleArchiveCategoryAction(id, isArchived);
        if (res.ok) router.refresh();
        return res;
      }}
      onDeleteCategory={async (id) => {
        const res = await deleteCategoryAction(id);
        if (res.ok) router.refresh();
        return res;
      }}
      onUpdateProfile={async (input) => {
        const res = await updateProfileAction(input);
        if (res.ok) router.refresh();
        return res;
      }}
      onChangePassword={async (input) => {
        const res = await changePasswordAction(input);
        if (res.ok) router.refresh();
        return res;
      }}
      onExportFullBackup={() => exportUserBackupAction()}
      onRestoreFullBackup={async (bundle) => {
        const res = await restoreUserBackupAction(bundle);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
