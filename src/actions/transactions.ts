"use server";

import Decimal from "decimal.js";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  categories,
  salarySettings,
  transactions,
  wallets,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import {
  detectTaxThresholdCrossing,
  type TaxToastAlert,
} from "@/lib/thai-tax";
import type { ActionResult, TransactionType } from "@/lib/types";
import { transactionSchema } from "@/lib/validations";

function revalidateAllMoneyViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/manage");
  revalidatePath("/plan");
}

export interface TransactionFormInput {
  type: TransactionType;
  walletId: string;
  toWalletId?: string | null;
  categoryId?: string | null;
  amount: string;
  transactionDate: string;
  transactionTime?: string | null;
  note?: string | null;
  recipientName?: string | null;
  recipientBank?: string | null;
  recipientAccount?: string | null;
}

async function verifyTransactionOwnership(
  userId: string,
  data: {
    type: TransactionType;
    walletId: string;
    toWalletId: string | null;
    categoryId: string | null;
  }
): Promise<string | null> {
  const [sourceWallet] = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.id, data.walletId), eq(wallets.userId, userId)))
    .limit(1);

  if (!sourceWallet) {
    return "ไม่พบกระเป๋าเงินต้นทางที่เลือก";
  }

  if (data.type === "transfer") {
    if (!data.toWalletId) return "กรุณาเลือกกระเป๋าเงินปลายทาง";
    const [destWallet] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.id, data.toWalletId), eq(wallets.userId, userId)))
      .limit(1);
    if (!destWallet) {
      return "ไม่พบกระเป๋าเงินปลายทางที่เลือก";
    }
  } else {
    if (!data.categoryId) return "กรุณาเลือกหมวดหมู่";
    const [cat] = await db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) {
      return "ไม่พบหมวดหมู่ที่เลือก";
    }
    if (cat.type !== data.type) {
      return "ประเภทหมวดหมู่ไม่ตรงกับประเภทรายการ";
    }
  }

  return null;
}

export async function createTransactionAction(
  input: TransactionFormInput
): Promise<ActionResult<{ id: string; taxAlert?: TaxToastAlert | null }>> {
  const user = await requireUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลรายการไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const ownershipError = await verifyTransactionOwnership(user.id, parsed.data);
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const [created] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        type: parsed.data.type,
        walletId: parsed.data.walletId,
        toWalletId: parsed.data.toWalletId,
        categoryId: parsed.data.categoryId,
        amount: parsed.data.amount,
        transactionDate: parsed.data.transactionDate,
        transactionTime: parsed.data.transactionTime,
        note: parsed.data.note,
        recipientName: parsed.data.recipientName,
        recipientBank: parsed.data.recipientBank,
        recipientAccount: parsed.data.recipientAccount,
      })
      .returning({ id: transactions.id });

    let taxAlert: TaxToastAlert | null = null;
    if (parsed.data.type === "income") {
      const txYear = parsed.data.transactionDate.slice(0, 4);
      const [sumRows, salaryRows] = await Promise.all([
        db
          .select({
            total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.id),
              eq(transactions.type, "income"),
              gte(transactions.transactionDate, `${txYear}-01-01`),
              lte(transactions.transactionDate, `${txYear}-12-31`)
            )
          ),
        db
          .select({ monthlySalary: salarySettings.monthlySalary })
          .from(salarySettings)
          .where(eq(salarySettings.userId, user.id))
          .limit(1),
      ]);

      const nextAnnualIncome = new Decimal(sumRows[0]?.total ?? "0");
      const prevAnnualIncome = Decimal.max(
        0,
        nextAnnualIncome.minus(parsed.data.amount)
      );
      taxAlert = detectTaxThresholdCrossing({
        prevAnnualIncome,
        nextAnnualIncome,
        monthlySalary: salaryRows[0]?.monthlySalary,
      });
    }

    revalidateAllMoneyViews();
    return { ok: true, data: { id: created.id, taxAlert } };
  } catch (error) {
    console.error("createTransactionAction error:", error);
    return { ok: false, error: "ไม่สามารถบันทึกรายการได้" };
  }
}

export async function updateTransactionAction(
  transactionId: string,
  input: TransactionFormInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลรายการไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const ownershipError = await verifyTransactionOwnership(user.id, parsed.data);
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const updated = await db
      .update(transactions)
      .set({
        type: parsed.data.type,
        walletId: parsed.data.walletId,
        toWalletId: parsed.data.toWalletId,
        categoryId: parsed.data.categoryId,
        amount: parsed.data.amount,
        transactionDate: parsed.data.transactionDate,
        transactionTime: parsed.data.transactionTime,
        note: parsed.data.note,
        recipientName: parsed.data.recipientName,
        recipientBank: parsed.data.recipientBank,
        recipientAccount: parsed.data.recipientAccount,
      })
      .where(
        and(eq(transactions.id, transactionId), eq(transactions.userId, user.id))
      )
      .returning({ id: transactions.id });

    if (updated.length === 0) {
      return { ok: false, error: "ไม่พบรายการที่ต้องการแก้ไข" };
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("updateTransactionAction error:", error);
    return { ok: false, error: "ไม่สามารถแก้ไขรายการได้" };
  }
}

export async function deleteTransactionAction(
  transactionId: string
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const deleted = await db
      .delete(transactions)
      .where(
        and(eq(transactions.id, transactionId), eq(transactions.userId, user.id))
      )
      .returning({ id: transactions.id });

    if (deleted.length === 0) {
      return { ok: false, error: "ไม่พบรายการที่ต้องการลบ" };
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("deleteTransactionAction error:", error);
    return { ok: false, error: "ไม่สามารถลบรายการได้" };
  }
}

export async function bulkImportTransactionsAction(
  rows: TransactionFormInput[]
): Promise<ActionResult<{ importedCount: number }>> {
  const user = await requireUser();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "ไม่มีรายการที่ต้องการนำเข้า" };
  }
  if (rows.length > 500) {
    return {
      ok: false,
      error: "นำเข้าได้สูงสุด 500 รายการต่อครั้ง",
    };
  }

  try {
    const [userWallets, userCategories] = await Promise.all([
      db
        .select({ id: wallets.id })
        .from(wallets)
        .where(eq(wallets.userId, user.id)),
      db
        .select({ id: categories.id, type: categories.type })
        .from(categories)
        .where(eq(categories.userId, user.id)),
    ]);

    const walletIds = new Set(userWallets.map((w) => w.id));
    const categoryMap = new Map(userCategories.map((c) => [c.id, c.type]));

    const valuesToInsert: Array<typeof transactions.$inferInsert> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const parsed = transactionSchema.safeParse(rows[i]);
      if (!parsed.success) {
        return {
          ok: false,
          error: `แถวที่ ${i + 1}: ข้อมูลรายการไม่ถูกต้อง`,
        };
      }

      const d = parsed.data;
      if (!walletIds.has(d.walletId)) {
        return {
          ok: false,
          error: `แถวที่ ${i + 1}: ไม่พบกระเป๋าเงินต้นทาง`,
        };
      }

      if (d.type === "transfer") {
        if (!d.toWalletId || !walletIds.has(d.toWalletId)) {
          return {
            ok: false,
            error: `แถวที่ ${i + 1}: ไม่พบกระเป๋าเงินปลายทาง`,
          };
        }
      } else {
        const catType = d.categoryId ? categoryMap.get(d.categoryId) : undefined;
        if (!catType || catType !== d.type) {
          return {
            ok: false,
            error: `แถวที่ ${i + 1}: หมวดหมู่ไม่ตรงกับประเภทรายการ`,
          };
        }
      }

      valuesToInsert.push({
        userId: user.id,
        type: d.type,
        walletId: d.walletId,
        toWalletId: d.toWalletId,
        categoryId: d.categoryId,
        amount: d.amount,
        transactionDate: d.transactionDate,
        note: d.note,
        recipientName: d.recipientName,
        recipientBank: d.recipientBank,
        recipientAccount: d.recipientAccount,
      });
    }

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values(valuesToInsert);
    });

    revalidateAllMoneyViews();
    return { ok: true, data: { importedCount: valuesToInsert.length } };
  } catch (error) {
    console.error("bulkImportTransactionsAction error:", error);
    return { ok: false, error: "ไม่สามารถนำเข้ารายการได้" };
  }
}
