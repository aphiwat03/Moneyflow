"use server";

import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  categories,
  salaryAllocations,
  salarySettings,
  transactions,
  wallets,
} from "@/db/schema";
import {
  createBackupBundle,
  parseBackupBundle,
  remapBackupBundleIds,
  type MoneyFlowBackupBundle,
} from "@/lib/portable-backup";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

function revalidateAllViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/plan");
  revalidatePath("/manage");
}

export async function exportUserBackupAction(): Promise<
  ActionResult<MoneyFlowBackupBundle>
> {
  const user = await requireUser();

  try {
    const [
      userWallets,
      userCategories,
      userSettingsRows,
      userAllocations,
      userTransactions,
    ] = await Promise.all([
      db
        .select({
          id: wallets.id,
          name: wallets.name,
          type: wallets.type,
          initialBalance: wallets.initialBalance,
          color: wallets.color,
          icon: wallets.icon,
          isArchived: wallets.isArchived,
        })
        .from(wallets)
        .where(eq(wallets.userId, user.id))
        .orderBy(asc(wallets.createdAt)),
      db
        .select({
          id: categories.id,
          name: categories.name,
          type: categories.type,
          monthlyBudget: categories.monthlyBudget,
          color: categories.color,
          icon: categories.icon,
          isDefault: categories.isDefault,
          isArchived: categories.isArchived,
        })
        .from(categories)
        .where(eq(categories.userId, user.id))
        .orderBy(asc(categories.createdAt)),
      db
        .select({
          monthlySalary: salarySettings.monthlySalary,
          extraIncome: salarySettings.extraIncome,
          payday: salarySettings.payday,
          salaryWalletId: salarySettings.salaryWalletId,
        })
        .from(salarySettings)
        .where(eq(salarySettings.userId, user.id))
        .limit(1),
      db
        .select({
          id: salaryAllocations.id,
          name: salaryAllocations.name,
          bucketType: salaryAllocations.bucketType,
          mode: salaryAllocations.mode,
          value: salaryAllocations.value,
          targetTotal: salaryAllocations.targetTotal,
          targetMonths: salaryAllocations.targetMonths,
          linkedWalletId: salaryAllocations.linkedWalletId,
          sortOrder: salaryAllocations.sortOrder,
          isActive: salaryAllocations.isActive,
        })
        .from(salaryAllocations)
        .where(eq(salaryAllocations.userId, user.id))
        .orderBy(asc(salaryAllocations.sortOrder), asc(salaryAllocations.createdAt)),
      db
        .select({
          id: transactions.id,
          type: transactions.type,
          walletId: transactions.walletId,
          toWalletId: transactions.toWalletId,
          categoryId: transactions.categoryId,
          amount: transactions.amount,
          transactionDate: transactions.transactionDate,
          note: transactions.note,
        })
        .from(transactions)
        .where(eq(transactions.userId, user.id))
        .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt)),
    ]);

    const bundle = createBackupBundle({
      wallets: userWallets,
      categories: userCategories,
      salarySettings: userSettingsRows[0] ?? null,
      salaryAllocations: userAllocations,
      transactions: userTransactions,
    });

    return { ok: true, data: bundle };
  } catch (error) {
    console.error("[exportUserBackupAction]", error);
    return {
      ok: false,
      error: "ไม่สามารถสร้างไฟล์สำรองข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
    };
  }
}

export async function restoreUserBackupAction(
  rawBundle: unknown
): Promise<
  ActionResult<{
    walletsCount: number;
    categoriesCount: number;
    transactionsCount: number;
    allocationsCount: number;
  }>
> {
  const user = await requireUser();
  const parsed = parseBackupBundle(rawBundle);

  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
    };
  }

  // Rotate entity IDs while preserving all relational links so importing from
  // /demo or another PostgreSQL instance never collides with existing UUID PKs.
  const bundle = remapBackupBundleIds(parsed.data);

  try {
    await db.transaction(async (tx) => {
      // Delete existing user records in FK-safe order
      await tx.delete(transactions).where(eq(transactions.userId, user.id));
      await tx
        .delete(salaryAllocations)
        .where(eq(salaryAllocations.userId, user.id));
      await tx
        .delete(salarySettings)
        .where(eq(salarySettings.userId, user.id));
      await tx.delete(categories).where(eq(categories.userId, user.id));
      await tx.delete(wallets).where(eq(wallets.userId, user.id));

      if (bundle.wallets.length > 0) {
        await tx.insert(wallets).values(
          bundle.wallets.map((w) => ({
            id: w.id,
            userId: user.id,
            name: w.name,
            type: w.type,
            initialBalance: w.initialBalance,
            color: w.color,
            icon: w.icon,
            isArchived: w.isArchived,
          }))
        );
      }

      if (bundle.categories.length > 0) {
        await tx.insert(categories).values(
          bundle.categories.map((c) => ({
            id: c.id,
            userId: user.id,
            name: c.name,
            type: c.type,
            monthlyBudget: c.monthlyBudget,
            color: c.color,
            icon: c.icon,
            isDefault: c.isDefault,
            isArchived: c.isArchived,
          }))
        );
      }

      if (bundle.salarySettings) {
        await tx.insert(salarySettings).values({
          userId: user.id,
          monthlySalary: bundle.salarySettings.monthlySalary,
          extraIncome: bundle.salarySettings.extraIncome ?? "0.00",
          payday: bundle.salarySettings.payday,
          salaryWalletId: bundle.salarySettings.salaryWalletId,
        });
      }

      if (bundle.salaryAllocations.length > 0) {
        await tx.insert(salaryAllocations).values(
          bundle.salaryAllocations.map((a) => ({
            id: a.id,
            userId: user.id,
            name: a.name,
            bucketType: a.bucketType,
            mode: a.mode,
            value: a.value,
            targetTotal: a.targetTotal,
            targetMonths: a.targetMonths,
            linkedWalletId: a.linkedWalletId,
            sortOrder: a.sortOrder,
            isActive: a.isActive,
          }))
        );
      }

      if (bundle.transactions.length > 0) {
        await tx.insert(transactions).values(
          bundle.transactions.map((t) => ({
            id: t.id,
            userId: user.id,
            type: t.type,
            walletId: t.walletId,
            toWalletId: t.toWalletId,
            categoryId: t.categoryId,
            amount: t.amount,
            transactionDate: t.transactionDate,
            note: t.note,
          }))
        );
      }
    });

    revalidateAllViews();
    return {
      ok: true,
      data: {
        walletsCount: bundle.wallets.length,
        categoriesCount: bundle.categories.length,
        transactionsCount: bundle.transactions.length,
        allocationsCount: bundle.salaryAllocations.length,
      },
    };
  } catch (error) {
    console.error("[restoreUserBackupAction]", error);
    return {
      ok: false,
      error: "ไม่สามารถกู้คืนข้อมูลจากไฟล์สำรองได้ กรุณาตรวจสอบไฟล์แล้วลองใหม่",
    };
  }
}
