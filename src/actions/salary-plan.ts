"use server";

import Decimal from "decimal.js";
import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  salaryAllocations,
  salarySettings,
  transactions,
  wallets,
} from "@/db/schema";
import {
  getBangkokToday,
  getBangkokYearMonth,
  getMonthDateRange,
} from "@/lib/date";
import { buildSalaryPlanSummary } from "@/lib/salary-plan";
import { requireUser } from "@/lib/session";
import {
  buildSalaryPlanTaxToast,
  estimateThaiPersonalIncomeTax,
  type TaxToastAlert,
} from "@/lib/thai-tax";
import type {
  ActionResult,
  PlanAllocationMode,
  PlanBucketType,
  TransactionDTO,
  WalletDTO,
} from "@/lib/types";
import {
  salaryAllocationSchema,
  salarySettingsSchema,
} from "@/lib/validations";

function revalidatePlanAndMoneyViews() {
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/transactions");
  revalidatePath("/manage");
}

export interface SalarySettingsFormInput {
  monthlySalary: string;
  extraIncome?: string;
  payday: number;
  salaryWalletId?: string | null;
}

export interface SalaryAllocationFormInput {
  name: string;
  bucketType: PlanBucketType;
  mode: PlanAllocationMode;
  value: string;
  targetTotal?: string | null;
  targetMonths?: number | null;
  linkedWalletId?: string | null;
  isActive?: boolean;
}

export async function saveSalarySettingsAction(
  input: SalarySettingsFormInput
): Promise<ActionResult<{ taxAlert?: TaxToastAlert }>> {
  const user = await requireUser();
  const parsed = salarySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลการตั้งค่าเงินเดือนไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    if (parsed.data.salaryWalletId) {
      const [owned] = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(
          and(
            eq(wallets.id, parsed.data.salaryWalletId),
            eq(wallets.userId, user.id)
          )
        )
        .limit(1);
      if (!owned) {
        return { ok: false, error: "ไม่พบกระเป๋ารับเงินเดือนที่เลือก" };
      }
    }

    await db
      .insert(salarySettings)
      .values({
        userId: user.id,
        monthlySalary: parsed.data.monthlySalary,
        extraIncome: parsed.data.extraIncome,
        payday: parsed.data.payday,
        salaryWalletId: parsed.data.salaryWalletId,
      })
      .onConflictDoUpdate({
        target: salarySettings.userId,
        set: {
          monthlySalary: parsed.data.monthlySalary,
          extraIncome: parsed.data.extraIncome,
          payday: parsed.data.payday,
          salaryWalletId: parsed.data.salaryWalletId,
        },
      });

    const annualProjected = new Decimal(parsed.data.monthlySalary)
      .plus(parsed.data.extraIncome)
      .times(12);
    const taxAlert = annualProjected.gt(0)
      ? buildSalaryPlanTaxToast(
          estimateThaiPersonalIncomeTax({
            annualIncome: annualProjected,
            monthlySalary: parsed.data.monthlySalary,
          })
        )
      : undefined;

    revalidatePlanAndMoneyViews();
    return { ok: true, data: { taxAlert } };
  } catch (error) {
    console.error("saveSalarySettingsAction error:", error);
    return { ok: false, error: "ไม่สามารถบันทึกการตั้งค่าเงินเดือนได้" };
  }
}

export async function createSalaryAllocationAction(
  input: SalaryAllocationFormInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = salaryAllocationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลเป้าหมายการออมไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    if (parsed.data.linkedWalletId) {
      const [owned] = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(
          and(
            eq(wallets.id, parsed.data.linkedWalletId),
            eq(wallets.userId, user.id)
          )
        )
        .limit(1);
      if (!owned) {
        return { ok: false, error: "ไม่พบกระเป๋าเป้าหมายที่เลือก" };
      }
    }

    const existing = await db
      .select({ sortOrder: salaryAllocations.sortOrder })
      .from(salaryAllocations)
      .where(eq(salaryAllocations.userId, user.id))
      .orderBy(asc(salaryAllocations.sortOrder));

    const nextOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => e.sortOrder)) + 1
        : 0;

    const [created] = await db
      .insert(salaryAllocations)
      .values({
        userId: user.id,
        name: parsed.data.name,
        bucketType: parsed.data.bucketType,
        mode: parsed.data.mode,
        value: parsed.data.value,
        targetTotal: parsed.data.targetTotal,
        targetMonths: parsed.data.targetMonths,
        linkedWalletId: parsed.data.linkedWalletId,
        sortOrder: nextOrder,
        isActive: parsed.data.isActive,
      })
      .returning({ id: salaryAllocations.id });

    revalidatePlanAndMoneyViews();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    console.error("createSalaryAllocationAction error:", error);
    return { ok: false, error: "ไม่สามารถเพิ่มเป้าหมายได้" };
  }
}

export async function updateSalaryAllocationAction(
  allocationId: string,
  input: SalaryAllocationFormInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = salaryAllocationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลเป้าหมายการออมไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    if (parsed.data.linkedWalletId) {
      const [owned] = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(
          and(
            eq(wallets.id, parsed.data.linkedWalletId),
            eq(wallets.userId, user.id)
          )
        )
        .limit(1);
      if (!owned) {
        return { ok: false, error: "ไม่พบกระเป๋าเป้าหมายที่เลือก" };
      }
    }

    const updated = await db
      .update(salaryAllocations)
      .set({
        name: parsed.data.name,
        bucketType: parsed.data.bucketType,
        mode: parsed.data.mode,
        value: parsed.data.value,
        targetTotal: parsed.data.targetTotal,
        targetMonths: parsed.data.targetMonths,
        linkedWalletId: parsed.data.linkedWalletId,
        isActive: parsed.data.isActive,
      })
      .where(
        and(
          eq(salaryAllocations.id, allocationId),
          eq(salaryAllocations.userId, user.id)
        )
      )
      .returning({ id: salaryAllocations.id });

    if (updated.length === 0) {
      return { ok: false, error: "ไม่พบเป้าหมายที่ต้องการแก้ไข" };
    }

    revalidatePlanAndMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("updateSalaryAllocationAction error:", error);
    return { ok: false, error: "ไม่สามารถแก้ไขเป้าหมายได้" };
  }
}

export async function deleteSalaryAllocationAction(
  allocationId: string
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const deleted = await db
      .delete(salaryAllocations)
      .where(
        and(
          eq(salaryAllocations.id, allocationId),
          eq(salaryAllocations.userId, user.id)
        )
      )
      .returning({ id: salaryAllocations.id });

    if (deleted.length === 0) {
      return { ok: false, error: "ไม่พบเป้าหมายที่ต้องการลบ" };
    }

    revalidatePlanAndMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("deleteSalaryAllocationAction error:", error);
    return { ok: false, error: "ไม่สามารถลบเป้าหมายได้" };
  }
}

export async function applyRecommendedSplitAction(params: {
  strategyId: "balanced" | "conservative" | "aggressive_invest";
  replaceExisting?: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();

  const presets: Record<
    "balanced" | "conservative" | "aggressive_invest",
    Array<{
      name: string;
      bucketType: PlanBucketType;
      value: string;
    }>
  > = {
    balanced: [
      { name: "เงินเย็น (สำรองฉุกเฉิน)", bucketType: "cold_money", value: "10.00" },
      { name: "ลงทุน DCA รายเดือน", bucketType: "dca", value: "10.00" },
      { name: "ของที่อยากได้ (Wishlist)", bucketType: "wishlist", value: "5.00" },
    ],
    conservative: [
      { name: "เงินเย็น (สำรองฉุกเฉิน)", bucketType: "cold_money", value: "15.00" },
      { name: "ลงทุน DCA รายเดือน", bucketType: "dca", value: "10.00" },
      { name: "ของที่อยากได้ (Wishlist)", bucketType: "wishlist", value: "5.00" },
    ],
    aggressive_invest: [
      { name: "เงินเย็น (สำรองฉุกเฉิน)", bucketType: "cold_money", value: "15.00" },
      { name: "ลงทุน DCA รายเดือน", bucketType: "dca", value: "20.00" },
      { name: "ของที่อยากได้ (Wishlist)", bucketType: "wishlist", value: "5.00" },
    ],
  };

  const chosen = presets[params.strategyId];
  if (!chosen) {
    return { ok: false, error: "ไม่พบรูปแบบสัดส่วนที่เลือก" };
  }

  try {
    await db.transaction(async (tx) => {
      let baseOrder = 0;
      if (params.replaceExisting) {
        await tx
          .delete(salaryAllocations)
          .where(eq(salaryAllocations.userId, user.id));
      } else {
        const current = await tx
          .select({ sortOrder: salaryAllocations.sortOrder })
          .from(salaryAllocations)
          .where(eq(salaryAllocations.userId, user.id));
        if (current.length > 0) {
          baseOrder = Math.max(...current.map((c) => c.sortOrder)) + 1;
        }
      }

      await tx.insert(salaryAllocations).values(
        chosen.map((item, idx) => ({
          userId: user.id,
          name: item.name,
          bucketType: item.bucketType,
          mode: "percent" as const,
          value: item.value,
          targetTotal: null,
          targetMonths: null,
          linkedWalletId: null,
          sortOrder: baseOrder + idx,
          isActive: true,
        }))
      );
    });

    revalidatePlanAndMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("applyRecommendedSplitAction error:", error);
    return { ok: false, error: "ไม่สามารถสร้างแผนจากสัดส่วนแนะนำได้" };
  }
}

export async function executeMonthlyAllocationTransfersAction(input: {
  year: number;
  month: number;
}): Promise<ActionResult<{ createdCount: number; totalTransferred: string }>> {
  const user = await requireUser();

  if (
    !Number.isInteger(input.year) ||
    !Number.isInteger(input.month) ||
    input.month < 1 ||
    input.month > 12
  ) {
    return { ok: false, error: "เดือนหรือปีที่เลือกไม่ถูกต้อง" };
  }

  try {
    const bangkokNow = getBangkokYearMonth();
    const todayIso = getBangkokToday();
    const { startDate, endDate } = getMonthDateRange(input.year, input.month);
    const transferDate =
      input.year === bangkokNow.year && input.month === bangkokNow.month
        ? todayIso
        : startDate;

    const txResult = await db.transaction(async (tx) => {
      const [settingsRow] = await tx
        .select()
        .from(salarySettings)
        .where(eq(salarySettings.userId, user.id))
        .limit(1);

      if (!settingsRow?.salaryWalletId) {
        return {
          ok: false as const,
          error: "กรุณาเลือกกระเป๋ารับเงินเดือนก่อนกดโอนตามแผน",
        };
      }

      const fromWallet = alias(wallets, "from_wallet");
      const toWallet = alias(wallets, "to_wallet");

      const [walletRows, allocationRows, monthTxs] = await Promise.all([
        tx
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
          .where(eq(wallets.userId, user.id)),
        tx
          .select()
          .from(salaryAllocations)
          .where(eq(salaryAllocations.userId, user.id))
          .orderBy(asc(salaryAllocations.sortOrder), asc(salaryAllocations.createdAt)),
        tx
          .select({
            id: transactions.id,
            type: transactions.type,
            walletId: transactions.walletId,
            walletName: fromWallet.name,
            walletType: fromWallet.type,
            toWalletId: transactions.toWalletId,
            toWalletName: toWallet.name,
            categoryId: transactions.categoryId,
            amount: transactions.amount,
            transactionDate: transactions.transactionDate,
            note: transactions.note,
          })
          .from(transactions)
          .innerJoin(
            fromWallet,
            and(
              eq(transactions.walletId, fromWallet.id),
              eq(transactions.userId, fromWallet.userId)
            )
          )
          .leftJoin(
            toWallet,
            and(
              eq(transactions.toWalletId, toWallet.id),
              eq(transactions.userId, toWallet.userId)
            )
          )
          .where(
            and(
              eq(transactions.userId, user.id),
              or(
                and(
                  gte(transactions.transactionDate, startDate),
                  lte(transactions.transactionDate, endDate)
                ),
                eq(transactions.transactionDate, todayIso)
              )
            )
          ),
      ]);

      const sourceWallet = walletRows.find(
        (w) => w.id === settingsRow.salaryWalletId && !w.isArchived
      );
      if (!sourceWallet) {
        return {
          ok: false as const,
          error: "กระเป๋ารับเงินเดือนไม่พร้อมใช้งานหรือถูกซ่อนอยู่",
        };
      }

      const walletDtos: WalletDTO[] = walletRows.map((w) => ({
        ...w,
        currentBalance: w.initialBalance,
      }));
      const walletDtoMap = new Map(walletDtos.map((w) => [w.id, w]));

      const txDtos: TransactionDTO[] = monthTxs.map((r) => ({
        id: r.id,
        type: r.type,
        walletId: r.walletId,
        walletName: r.walletName,
        walletType: r.walletType,
        toWalletId: r.toWalletId,
        toWalletName: r.toWalletName,
        categoryId: r.categoryId,
        categoryName: null,
        categoryColor: null,
        amount: r.amount,
        transactionDate: r.transactionDate,
        note: r.note,
      }));

      const summary = buildSalaryPlanSummary({
        settings: {
          monthlySalary: settingsRow.monthlySalary,
          extraIncome: settingsRow.extraIncome,
          payday: settingsRow.payday,
          salaryWalletId: settingsRow.salaryWalletId,
        },
        allocations: allocationRows.map((a) => ({
          id: a.id,
          name: a.name,
          bucketType: a.bucketType,
          mode: a.mode,
          value: a.value,
          targetTotal: a.targetTotal,
          targetMonths: a.targetMonths,
          linkedWalletId: a.linkedWalletId,
          sortOrder: a.sortOrder,
          isActive: a.isActive,
        })),
        wallets: walletDtos,
        transactions: txDtos,
        selectedYear: input.year,
        selectedMonth: input.month,
      });

      const pendingItems = summary.allocations.filter((item) => {
        if (!item.isActive || !item.linkedWalletId) return false;
        if (item.linkedWalletId === sourceWallet.id) return false;
        const dest = walletDtoMap.get(item.linkedWalletId);
        if (!dest || dest.isArchived) return false;
        return new Decimal(item.pendingTransfer).gt(0);
      });

      if (pendingItems.length === 0) {
        return {
          ok: false as const,
          error:
            "ไม่มีรายการที่ต้องโอนในเดือนนี้ (โอนครบแล้ว หรือยังไม่ได้ผูกกระเป๋าปลายทาง)",
        };
      }

      let totalTransferred = new Decimal(0);
      const valuesToInsert = pendingItems.map((item) => {
        totalTransferred = totalTransferred.plus(item.pendingTransfer);
        return {
          userId: user.id,
          type: "transfer" as const,
          walletId: sourceWallet.id,
          toWalletId: item.linkedWalletId!,
          categoryId: null,
          amount: item.pendingTransfer,
          transactionDate: transferDate,
          note: `โอนตามแผน: ${item.name}`,
        };
      });

      await tx.insert(transactions).values(valuesToInsert);

      return {
        ok: true as const,
        data: {
          createdCount: valuesToInsert.length,
          totalTransferred: totalTransferred.toFixed(2),
        },
      };
    });

    if (!txResult.ok) {
      return txResult;
    }

    revalidatePlanAndMoneyViews();
    return txResult;
  } catch (error) {
    console.error("executeMonthlyAllocationTransfersAction error:", error);
    return { ok: false, error: "ไม่สามารถสร้างรายการโอนตามแผนได้" };
  }
}
