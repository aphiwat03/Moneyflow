"use server";

import Decimal from "decimal.js";
import { and, count, eq, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transactions, wallets } from "@/db/schema";
import { computeWalletBalance, formatFixed2 } from "@/lib/decimal";
import { requireUser } from "@/lib/session";
import type { ActionResult, WalletType } from "@/lib/types";
import { adjustWalletBalanceSchema, walletSchema } from "@/lib/validations";

function revalidateAllMoneyViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/manage");
  revalidatePath("/plan");
}

export async function createWalletAction(input: {
  name: string;
  type: WalletType;
  initialBalance: string;
  color?: string | null;
  icon?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = walletSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลกระเป๋าเงินไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const [created] = await db
      .insert(wallets)
      .values({
        userId: user.id,
        name: parsed.data.name,
        type: parsed.data.type,
        initialBalance: parsed.data.initialBalance,
        color: parsed.data.color ?? "#0f766e",
        icon: parsed.data.icon ?? "Wallet",
      })
      .returning({ id: wallets.id });

    revalidateAllMoneyViews();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    console.error("createWalletAction error:", error);
    return { ok: false, error: "ไม่สามารถสร้างกระเป๋าเงินได้" };
  }
}

export async function updateWalletAction(
  walletId: string,
  input: {
    name: string;
    type: WalletType;
    initialBalance: string;
    color?: string | null;
    icon?: string | null;
  }
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = walletSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลกระเป๋าเงินไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await db
      .update(wallets)
      .set({
        name: parsed.data.name,
        type: parsed.data.type,
        initialBalance: parsed.data.initialBalance,
        color: parsed.data.color ?? "#0f766e",
        icon: parsed.data.icon ?? "Wallet",
      })
      .where(and(eq(wallets.id, walletId), eq(wallets.userId, user.id)))
      .returning({ id: wallets.id });

    if (updated.length === 0) {
      return { ok: false, error: "ไม่พบกระเป๋าเงินที่ต้องการแก้ไข" };
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("updateWalletAction error:", error);
    return { ok: false, error: "ไม่สามารถแก้ไขกระเป๋าเงินได้" };
  }
}

export async function toggleArchiveWalletAction(
  walletId: string,
  isArchived: boolean
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const updated = await db
      .update(wallets)
      .set({ isArchived })
      .where(and(eq(wallets.id, walletId), eq(wallets.userId, user.id)))
      .returning({ id: wallets.id });

    if (updated.length === 0) {
      return { ok: false, error: "ไม่พบกระเป๋าเงิน" };
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("toggleArchiveWalletAction error:", error);
    return { ok: false, error: "ไม่สามารถอัปเดตสถานะกระเป๋าเงินได้" };
  }
}

export async function deleteWalletAction(
  walletId: string
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: wallets.id })
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, user.id)))
        .for("update");

      if (!existing) {
        return { ok: false as const, error: "ไม่พบกระเป๋าเงินที่ต้องการลบ" };
      }

      const [txRef] = await tx
        .select({ total: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            or(
              eq(transactions.walletId, walletId),
              eq(transactions.toWalletId, walletId)
            )
          )
        );

      if ((txRef?.total ?? 0) > 0) {
        return {
          ok: false as const,
          error: `ไม่สามารถลบกระเป๋านี้ได้เนื่องจากมีรายการผูกอยู่ ${txRef.total} รายการ กรุณาใช้การซ่อน (Archive) แทน`,
        };
      }

      await tx
        .delete(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, user.id)));

      return { ok: true as const };
    });

    if (!result.ok) {
      return result;
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("deleteWalletAction error:", error);
    return { ok: false, error: "ไม่สามารถลบกระเป๋าเงินได้" };
  }
}

export async function adjustWalletBalanceAction(input: {
  walletId: string;
  actualBalance: string;
}): Promise<ActionResult<{ newInitialBalance: string }>> {
  const user = await requireUser();
  const parsed = adjustWalletBalanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ยอดคงเหลือไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({
          id: wallets.id,
          type: wallets.type,
          initialBalance: wallets.initialBalance,
        })
        .from(wallets)
        .where(
          and(eq(wallets.id, parsed.data.walletId), eq(wallets.userId, user.id))
        )
        .for("update");

      if (!target) {
        return {
          ok: false as const,
          error: "ไม่พบกระเป๋าเงินที่ต้องการปรับยอด",
        };
      }

      const actualDec = new Decimal(parsed.data.actualBalance);
      if (
        (target.type === "cash" ||
          target.type === "ewallet" ||
          target.type === "savings_goal" ||
          target.type === "investment") &&
        actualDec.isNegative()
      ) {
        return {
          ok: false as const,
          error: "ยอดคงเหลือของเงินสด E-Wallet กระเป๋าเป้าหมาย หรือพอร์ตลงทุน ต้องไม่ติดลบ",
        };
      }

      const [sums] = await tx
        .select({
          incomeTotal: sql<string>`coalesce(sum(case when ${transactions.walletId} = ${target.id} and ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)::text`,
          expenseTotal: sql<string>`coalesce(sum(case when ${transactions.walletId} = ${target.id} and ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)::text`,
          transferOutTotal: sql<string>`coalesce(sum(case when ${transactions.walletId} = ${target.id} and ${transactions.type} = 'transfer' then ${transactions.amount} else 0 end), 0)::text`,
          transferInTotal: sql<string>`coalesce(sum(case when ${transactions.toWalletId} = ${target.id} and ${transactions.type} = 'transfer' then ${transactions.amount} else 0 end), 0)::text`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            or(
              eq(transactions.walletId, target.id),
              eq(transactions.toWalletId, target.id)
            )
          )
        );

      const currentDec = computeWalletBalance({
        initialBalance: target.initialBalance,
        incomeTotal: sums?.incomeTotal ?? "0",
        expenseTotal: sums?.expenseTotal ?? "0",
        transferInTotal: sums?.transferInTotal ?? "0",
        transferOutTotal: sums?.transferOutTotal ?? "0",
      });

      const initialDec = new Decimal(target.initialBalance);
      const delta = actualDec.minus(currentDec);
      const nextInitial = formatFixed2(initialDec.plus(delta));

      await tx
        .update(wallets)
        .set({ initialBalance: nextInitial })
        .where(and(eq(wallets.id, target.id), eq(wallets.userId, user.id)));

      return { ok: true as const, data: { newInitialBalance: nextInitial } };
    });

    if (!result.ok) {
      return result;
    }

    revalidateAllMoneyViews();
    return result;
  } catch (error) {
    console.error("adjustWalletBalanceAction error:", error);
    return { ok: false, error: "ไม่สามารถปรับยอดคงเหลือได้" };
  }
}
