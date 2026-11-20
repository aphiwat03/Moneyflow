"use server";

import Decimal from "decimal.js";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  categories,
  investmentDcaLogs,
  investmentHoldings,
  investmentSettings,
  investmentSnapshots,
  transactions,
  wallets,
} from "@/db/schema";
import { formatFixed2, toDecimal } from "@/lib/decimal";
import {
  applyDcaPurchaseMath,
  reverseDcaPurchaseMath,
} from "@/lib/investment-calc";
import { requireUser } from "@/lib/session";
import type {
  ActionResult,
  InvestmentAssetType,
  InvestmentCurrency,
  InvestmentDcaLogDTO,
  InvestmentHoldingDTO,
  InvestmentPlanSettingsDTO,
  InvestmentSnapshotDTO,
} from "@/lib/types";
import {
  importLocalInvestmentsSchema,
  investmentHoldingSchema,
  investmentSettingsSchema,
  investmentSnapshotSchema,
  recordDcaExecutionSchema,
  recordDividendSchema,
} from "@/lib/validations";

function revalidateInvestmentViews() {
  revalidatePath("/");
  revalidatePath("/investments");
  revalidatePath("/transactions");
  revalidatePath("/plan");
  revalidatePath("/manage");
}

export interface InvestmentHoldingFormInput {
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  targetAllocationPct: number;
  expectedAnnualReturnPct: number;
  investedCost: string;
  currentValue: string;
  dividendsReceived: string;
  units?: string | null;
  currency?: InvestmentCurrency;
  broker?: string | null;
  note?: string | null;
  color?: string;
}

export interface InvestmentSnapshotFormInput {
  monthKey: string;
  investedCost: string;
  marketValue: string;
  dividends: string;
  note?: string | null;
}

export interface RecordDcaExecutionInput {
  holdingId: string;
  executedDate: string;
  amountThb: string;
  unitsBought?: string | null;
  pricePerUnit?: string | null;
  feeThb?: string;
  note?: string | null;
  createTransferTransaction?: boolean;
  sourceWalletId?: string | null;
  targetInvestmentWalletId?: string | null;
}

export interface RecordDividendInput {
  holdingId: string;
  receivedDate: string;
  amountThb: string;
  note?: string | null;
  createIncomeTransaction?: boolean;
  walletId?: string | null;
  categoryId?: string | null;
}

export async function saveInvestmentSettingsAction(
  input: InvestmentPlanSettingsDTO
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = investmentSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลแผนการลงทุนไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const s = parsed.data;
    await db
      .insert(investmentSettings)
      .values({
        userId: user.id,
        targetGoalAmount: s.targetGoalAmount,
        startingPrincipal: s.startingPrincipal,
        monthlyDca: s.monthlyDca,
        expectedAnnualReturnPct: s.expectedAnnualReturnPct.toFixed(2),
        horizonYears: s.horizonYears,
        annualDcaStepUpPct: s.annualDcaStepUpPct.toFixed(2),
        reinvestDividends: s.reinvestDividends,
      })
      .onConflictDoUpdate({
        target: investmentSettings.userId,
        set: {
          targetGoalAmount: s.targetGoalAmount,
          startingPrincipal: s.startingPrincipal,
          monthlyDca: s.monthlyDca,
          expectedAnnualReturnPct: s.expectedAnnualReturnPct.toFixed(2),
          horizonYears: s.horizonYears,
          annualDcaStepUpPct: s.annualDcaStepUpPct.toFixed(2),
          reinvestDividends: s.reinvestDividends,
        },
      });

    revalidatePath("/investments");
    return { ok: true };
  } catch (error) {
    console.error("[saveInvestmentSettingsAction]", error);
    return { ok: false, error: "ไม่สามารถบันทึกแผน DCA ได้" };
  }
}

export async function upsertInvestmentHoldingAction(
  input: InvestmentHoldingFormInput,
  editingId?: string
): Promise<ActionResult<InvestmentHoldingDTO>> {
  const user = await requireUser();
  const parsed = investmentHoldingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลสินทรัพย์ไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  try {
    if (editingId) {
      const [updated] = await db
        .update(investmentHoldings)
        .set({
          symbol: d.symbol,
          name: d.name,
          assetType: d.assetType,
          targetAllocationPct: d.targetAllocationPct.toFixed(2),
          expectedAnnualReturnPct: d.expectedAnnualReturnPct.toFixed(2),
          investedCost: d.investedCost,
          currentValue: d.currentValue,
          dividendsReceived: d.dividendsReceived,
          units: d.units,
          currency: d.currency,
          broker: d.broker,
          note: d.note,
          color: d.color,
        })
        .where(
          and(
            eq(investmentHoldings.id, editingId),
            eq(investmentHoldings.userId, user.id)
          )
        )
        .returning();

      if (!updated) {
        return { ok: false, error: "ไม่พบสินทรัพย์ที่ต้องการแก้ไข" };
      }

      revalidatePath("/investments");
      return {
        ok: true,
        data: {
          id: updated.id,
          symbol: updated.symbol,
          name: updated.name,
          assetType: updated.assetType,
          targetAllocationPct: Number(updated.targetAllocationPct),
          expectedAnnualReturnPct: Number(updated.expectedAnnualReturnPct),
          investedCost: updated.investedCost,
          currentValue: updated.currentValue,
          dividendsReceived: updated.dividendsReceived,
          units: updated.units,
          currency: updated.currency,
          broker: updated.broker,
          note: updated.note,
          color: updated.color,
          sortOrder: updated.sortOrder,
        },
      };
    }

    const existing = await db
      .select({ sortOrder: investmentHoldings.sortOrder })
      .from(investmentHoldings)
      .where(eq(investmentHoldings.userId, user.id))
      .orderBy(asc(investmentHoldings.sortOrder));

    const nextOrder =
      existing.length > 0
        ? Math.max(...existing.map((e) => e.sortOrder)) + 1
        : 0;

    const [created] = await db
      .insert(investmentHoldings)
      .values({
        userId: user.id,
        symbol: d.symbol,
        name: d.name,
        assetType: d.assetType,
        targetAllocationPct: d.targetAllocationPct.toFixed(2),
        expectedAnnualReturnPct: d.expectedAnnualReturnPct.toFixed(2),
        investedCost: d.investedCost,
        currentValue: d.currentValue,
        dividendsReceived: d.dividendsReceived,
        units: d.units,
        currency: d.currency,
        broker: d.broker,
        note: d.note,
        color: d.color,
        sortOrder: nextOrder,
      })
      .returning();

    revalidatePath("/investments");
    return {
      ok: true,
      data: {
        id: created.id,
        symbol: created.symbol,
        name: created.name,
        assetType: created.assetType,
        targetAllocationPct: Number(created.targetAllocationPct),
        expectedAnnualReturnPct: Number(created.expectedAnnualReturnPct),
        investedCost: created.investedCost,
        currentValue: created.currentValue,
        dividendsReceived: created.dividendsReceived,
        units: created.units,
        currency: created.currency,
        broker: created.broker,
        note: created.note,
        color: created.color,
        sortOrder: created.sortOrder,
      },
    };
  } catch (error) {
    console.error("[upsertInvestmentHoldingAction]", error);
    return { ok: false, error: "ไม่สามารถบันทึกข้อมูลสินทรัพย์ได้" };
  }
}

export async function deleteInvestmentHoldingAction(
  holdingId: string
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const deleted = await db
      .delete(investmentHoldings)
      .where(
        and(
          eq(investmentHoldings.id, holdingId),
          eq(investmentHoldings.userId, user.id)
        )
      )
      .returning({ id: investmentHoldings.id });

    if (deleted.length === 0) {
      return { ok: false, error: "ไม่พบสินทรัพย์ที่ต้องการลบ" };
    }

    revalidatePath("/investments");
    return { ok: true };
  } catch (error) {
    console.error("[deleteInvestmentHoldingAction]", error);
    return { ok: false, error: "ไม่สามารถลบสินทรัพย์ได้" };
  }
}

export async function upsertInvestmentSnapshotAction(
  input: InvestmentSnapshotFormInput
): Promise<ActionResult<InvestmentSnapshotDTO>> {
  const user = await requireUser();
  const parsed = investmentSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลยอดพอร์ตประจำเดือนไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  try {
    const [saved] = await db
      .insert(investmentSnapshots)
      .values({
        userId: user.id,
        monthKey: d.monthKey,
        investedCost: d.investedCost,
        marketValue: d.marketValue,
        dividends: d.dividends,
        note: d.note,
      })
      .onConflictDoUpdate({
        target: [investmentSnapshots.userId, investmentSnapshots.monthKey],
        set: {
          investedCost: d.investedCost,
          marketValue: d.marketValue,
          dividends: d.dividends,
          note: d.note,
        },
      })
      .returning();

    revalidatePath("/investments");
    return {
      ok: true,
      data: {
        id: saved.id,
        monthKey: saved.monthKey,
        investedCost: saved.investedCost,
        marketValue: saved.marketValue,
        dividends: saved.dividends,
        note: saved.note,
      },
    };
  } catch (error) {
    console.error("[upsertInvestmentSnapshotAction]", error);
    return { ok: false, error: "ไม่สามารถบันทึกยอดพอร์ตประจำเดือนได้" };
  }
}

export async function deleteInvestmentSnapshotAction(
  snapshotId: string
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const deleted = await db
      .delete(investmentSnapshots)
      .where(
        and(
          eq(investmentSnapshots.id, snapshotId),
          eq(investmentSnapshots.userId, user.id)
        )
      )
      .returning({ id: investmentSnapshots.id });

    if (deleted.length === 0) {
      return { ok: false, error: "ไม่พบรายการบันทึกยอดพอร์ตที่ต้องการลบ" };
    }

    revalidatePath("/investments");
    return { ok: true };
  } catch (error) {
    console.error("[deleteInvestmentSnapshotAction]", error);
    return { ok: false, error: "ไม่สามารถลบรายการบันทึกยอดพอร์ตได้" };
  }
}

export async function recordDcaExecutionAction(
  input: RecordDcaExecutionInput
): Promise<
  ActionResult<{
    log: InvestmentDcaLogDTO;
    updatedHolding: InvestmentHoldingDTO;
  }>
> {
  const user = await requireUser();
  const parsed = recordDcaExecutionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลบันทึกซื้อ DCA ไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [holding] = await tx
        .select()
        .from(investmentHoldings)
        .where(
          and(
            eq(investmentHoldings.id, d.holdingId),
            eq(investmentHoldings.userId, user.id)
          )
        )
        .limit(1);

      if (!holding) {
        return { ok: false as const, error: "ไม่พบสินทรัพย์ที่ต้องการบันทึกซื้อ DCA" };
      }

      let createdTransactionId: string | null = null;
      if (
        d.createTransferTransaction &&
        d.sourceWalletId &&
        d.targetInvestmentWalletId
      ) {
        const ownedWallets = await tx
          .select({ id: wallets.id })
          .from(wallets)
          .where(eq(wallets.userId, user.id));
        const ownedSet = new Set(ownedWallets.map((w) => w.id));

        if (
          !ownedSet.has(d.sourceWalletId) ||
          !ownedSet.has(d.targetInvestmentWalletId)
        ) {
          return {
            ok: false as const,
            error: "ไม่พบกระเป๋าเงินต้นทางหรือปลายทางที่เลือก",
          };
        }

        const [txRow] = await tx
          .insert(transactions)
          .values({
            userId: user.id,
            type: "transfer",
            walletId: d.sourceWalletId,
            toWalletId: d.targetInvestmentWalletId,
            categoryId: null,
            amount: d.amountThb,
            transactionDate: d.executedDate,
            note: d.note
              ? `DCA ${holding.symbol} · ${d.note}`
              : `DCA ${holding.symbol} (${holding.name})`,
          })
          .returning({ id: transactions.id });

        createdTransactionId = txRow.id;
      }

      const [logRow] = await tx
        .insert(investmentDcaLogs)
        .values({
          userId: user.id,
          holdingId: holding.id,
          transactionId: createdTransactionId,
          executedDate: d.executedDate,
          amountThb: d.amountThb,
          unitsBought: d.unitsBought,
          pricePerUnit: d.pricePerUnit,
          feeThb: d.feeThb,
          note: d.note,
        })
        .returning();

      const math = applyDcaPurchaseMath({
        currentInvestedCost: holding.investedCost,
        currentValue: holding.currentValue,
        currentUnits: holding.units,
        amountThb: d.amountThb,
        unitsBought: d.unitsBought,
      });

      const [updated] = await tx
        .update(investmentHoldings)
        .set({
          investedCost: math.nextInvestedCost,
          currentValue: math.nextCurrentValue,
          units: math.nextUnits,
        })
        .where(eq(investmentHoldings.id, holding.id))
        .returning();

      return {
        ok: true as const,
        data: {
          log: {
            id: logRow.id,
            holdingId: logRow.holdingId,
            holdingSymbol: holding.symbol,
            holdingName: holding.name,
            transactionId: logRow.transactionId,
            executedDate: logRow.executedDate,
            amountThb: logRow.amountThb,
            unitsBought: logRow.unitsBought,
            pricePerUnit: logRow.pricePerUnit,
            feeThb: logRow.feeThb,
            note: logRow.note,
          },
          updatedHolding: {
            id: updated.id,
            symbol: updated.symbol,
            name: updated.name,
            assetType: updated.assetType,
            targetAllocationPct: Number(updated.targetAllocationPct),
            expectedAnnualReturnPct: Number(updated.expectedAnnualReturnPct),
            investedCost: updated.investedCost,
            currentValue: updated.currentValue,
            dividendsReceived: updated.dividendsReceived,
            units: updated.units,
            currency: updated.currency,
            broker: updated.broker,
            note: updated.note,
            color: updated.color,
            sortOrder: updated.sortOrder,
          },
        },
      };
    });

    if (!result.ok) {
      return result;
    }

    revalidateInvestmentViews();
    return result;
  } catch (error) {
    console.error("[recordDcaExecutionAction]", error);
    return { ok: false, error: "ไม่สามารถบันทึกการซื้อ DCA ได้" };
  }
}

export async function deleteDcaLogAction(
  logId: string
): Promise<ActionResult<{ updatedHolding: InvestmentHoldingDTO | null }>> {
  const user = await requireUser();
  try {
    const result = await db.transaction(async (tx) => {
      const [logRow] = await tx
        .select()
        .from(investmentDcaLogs)
        .where(
          and(
            eq(investmentDcaLogs.id, logId),
            eq(investmentDcaLogs.userId, user.id)
          )
        )
        .limit(1);

      if (!logRow) {
        return { ok: false as const, error: "ไม่พบประวัติซื้อ DCA ที่ต้องการลบ" };
      }

      const [holding] = await tx
        .select()
        .from(investmentHoldings)
        .where(
          and(
            eq(investmentHoldings.id, logRow.holdingId),
            eq(investmentHoldings.userId, user.id)
          )
        )
        .limit(1);

      await tx
        .delete(investmentDcaLogs)
        .where(eq(investmentDcaLogs.id, logRow.id));

      if (logRow.transactionId) {
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, logRow.transactionId),
              eq(transactions.userId, user.id)
            )
          );
      }

      let updatedHolding: InvestmentHoldingDTO | null = null;
      if (holding) {
        const math = reverseDcaPurchaseMath({
          currentInvestedCost: holding.investedCost,
          currentValue: holding.currentValue,
          currentUnits: holding.units,
          amountThb: logRow.amountThb,
          unitsBought: logRow.unitsBought,
        });

        const [updated] = await tx
          .update(investmentHoldings)
          .set({
            investedCost: math.nextInvestedCost,
            currentValue: math.nextCurrentValue,
            units: math.nextUnits,
          })
          .where(eq(investmentHoldings.id, holding.id))
          .returning();

        updatedHolding = {
          id: updated.id,
          symbol: updated.symbol,
          name: updated.name,
          assetType: updated.assetType,
          targetAllocationPct: Number(updated.targetAllocationPct),
          expectedAnnualReturnPct: Number(updated.expectedAnnualReturnPct),
          investedCost: updated.investedCost,
          currentValue: updated.currentValue,
          dividendsReceived: updated.dividendsReceived,
          units: updated.units,
          currency: updated.currency,
          broker: updated.broker,
          note: updated.note,
          color: updated.color,
          sortOrder: updated.sortOrder,
        };
      }

      return { ok: true as const, data: { updatedHolding } };
    });

    if (!result.ok) {
      return result;
    }

    revalidateInvestmentViews();
    return result;
  } catch (error) {
    console.error("[deleteDcaLogAction]", error);
    return { ok: false, error: "ไม่สามารถลบประวัติซื้อ DCA ได้" };
  }
}

export async function recordDividendAction(
  input: RecordDividendInput
): Promise<ActionResult<{ updatedHolding: InvestmentHoldingDTO }>> {
  const user = await requireUser();
  const parsed = recordDividendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลบันทึกเงินปันผลไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      const [holding] = await tx
        .select()
        .from(investmentHoldings)
        .where(
          and(
            eq(investmentHoldings.id, d.holdingId),
            eq(investmentHoldings.userId, user.id)
          )
        )
        .limit(1);

      if (!holding) {
        return { ok: false as const, error: "ไม่พบสินทรัพย์ที่เลือก" };
      }

      if (d.createIncomeTransaction && d.walletId && d.categoryId) {
        const [ownedWallet] = await tx
          .select({ id: wallets.id })
          .from(wallets)
          .where(and(eq(wallets.id, d.walletId), eq(wallets.userId, user.id)))
          .limit(1);
        const [ownedCategory] = await tx
          .select({ id: categories.id, type: categories.type })
          .from(categories)
          .where(
            and(eq(categories.id, d.categoryId), eq(categories.userId, user.id))
          )
          .limit(1);

        if (!ownedWallet) {
          return { ok: false as const, error: "ไม่พบกระเป๋าเงินรับปันผลที่เลือก" };
        }
        if (!ownedCategory || ownedCategory.type !== "income") {
          return {
            ok: false as const,
            error: "หมวดหมู่ที่เลือกต้องเป็นหมวดหมู่รายรับเท่านั้น",
          };
        }

        await tx.insert(transactions).values({
          userId: user.id,
          type: "income",
          walletId: d.walletId,
          toWalletId: null,
          categoryId: d.categoryId,
          amount: d.amountThb,
          transactionDate: d.receivedDate,
          note: d.note
            ? `ปันผล ${holding.symbol} · ${d.note}`
            : `เงินปันผล ${holding.symbol}`,
        });
      }

      const nextDiv = formatFixed2(
        Decimal.max(0, toDecimal(holding.dividendsReceived)).plus(
          toDecimal(d.amountThb)
        )
      );

      const [updated] = await tx
        .update(investmentHoldings)
        .set({ dividendsReceived: nextDiv })
        .where(eq(investmentHoldings.id, holding.id))
        .returning();

      return {
        ok: true as const,
        data: {
          updatedHolding: {
            id: updated.id,
            symbol: updated.symbol,
            name: updated.name,
            assetType: updated.assetType,
            targetAllocationPct: Number(updated.targetAllocationPct),
            expectedAnnualReturnPct: Number(updated.expectedAnnualReturnPct),
            investedCost: updated.investedCost,
            currentValue: updated.currentValue,
            dividendsReceived: updated.dividendsReceived,
            units: updated.units,
            currency: updated.currency,
            broker: updated.broker,
            note: updated.note,
            color: updated.color,
            sortOrder: updated.sortOrder,
          },
        },
      };
    });

    if (!result.ok) {
      return result;
    }

    revalidateInvestmentViews();
    return result;
  } catch (error) {
    console.error("[recordDividendAction]", error);
    return { ok: false, error: "ไม่สามารถบันทึกเงินปันผลได้" };
  }
}

export async function importLocalInvestmentsAction(
  raw: unknown
): Promise<
  ActionResult<{
    settings: InvestmentPlanSettingsDTO | null;
    holdings: InvestmentHoldingDTO[];
    snapshots: InvestmentSnapshotDTO[];
  }>
> {
  const user = await requireUser();
  const parsed = importLocalInvestmentsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลแผนลงทุนจากเบราว์เซอร์ไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  try {
    const imported = await db.transaction(async (tx) => {
      let savedSettings: InvestmentPlanSettingsDTO | null = null;
      if (d.settings) {
        const s = d.settings;
        await tx
          .insert(investmentSettings)
          .values({
            userId: user.id,
            targetGoalAmount: s.targetGoalAmount,
            startingPrincipal: s.startingPrincipal,
            monthlyDca: s.monthlyDca,
            expectedAnnualReturnPct: s.expectedAnnualReturnPct.toFixed(2),
            horizonYears: s.horizonYears,
            annualDcaStepUpPct: s.annualDcaStepUpPct.toFixed(2),
            reinvestDividends: s.reinvestDividends,
          })
          .onConflictDoUpdate({
            target: investmentSettings.userId,
            set: {
              targetGoalAmount: s.targetGoalAmount,
              startingPrincipal: s.startingPrincipal,
              monthlyDca: s.monthlyDca,
              expectedAnnualReturnPct: s.expectedAnnualReturnPct.toFixed(2),
              horizonYears: s.horizonYears,
              annualDcaStepUpPct: s.annualDcaStepUpPct.toFixed(2),
              reinvestDividends: s.reinvestDividends,
            },
          });
        savedSettings = s;
      }

      const insertedHoldings: InvestmentHoldingDTO[] = [];
      if (d.holdings.length > 0) {
        const rows = await tx
          .insert(investmentHoldings)
          .values(
            d.holdings.map((h, idx) => ({
              userId: user.id,
              symbol: h.symbol,
              name: h.name,
              assetType: h.assetType,
              targetAllocationPct: h.targetAllocationPct.toFixed(2),
              expectedAnnualReturnPct: h.expectedAnnualReturnPct.toFixed(2),
              investedCost: h.investedCost,
              currentValue: h.currentValue,
              dividendsReceived: h.dividendsReceived,
              units: h.units,
              currency: h.currency,
              broker: h.broker,
              note: h.note,
              color: h.color,
              sortOrder: idx,
            }))
          )
          .returning();

        for (const r of rows) {
          insertedHoldings.push({
            id: r.id,
            symbol: r.symbol,
            name: r.name,
            assetType: r.assetType,
            targetAllocationPct: Number(r.targetAllocationPct),
            expectedAnnualReturnPct: Number(r.expectedAnnualReturnPct),
            investedCost: r.investedCost,
            currentValue: r.currentValue,
            dividendsReceived: r.dividendsReceived,
            units: r.units,
            currency: r.currency,
            broker: r.broker,
            note: r.note,
            color: r.color,
            sortOrder: r.sortOrder,
          });
        }
      }

      const insertedSnapshots: InvestmentSnapshotDTO[] = [];
      for (const snap of d.snapshots) {
        const [saved] = await tx
          .insert(investmentSnapshots)
          .values({
            userId: user.id,
            monthKey: snap.monthKey,
            investedCost: snap.investedCost,
            marketValue: snap.marketValue,
            dividends: snap.dividends,
            note: snap.note,
          })
          .onConflictDoUpdate({
            target: [investmentSnapshots.userId, investmentSnapshots.monthKey],
            set: {
              investedCost: snap.investedCost,
              marketValue: snap.marketValue,
              dividends: snap.dividends,
              note: snap.note,
            },
          })
          .returning();

        insertedSnapshots.push({
          id: saved.id,
          monthKey: saved.monthKey,
          investedCost: saved.investedCost,
          marketValue: saved.marketValue,
          dividends: saved.dividends,
          note: saved.note,
        });
      }

      return {
        settings: savedSettings,
        holdings: insertedHoldings,
        snapshots: insertedSnapshots,
      };
    });

    revalidatePath("/investments");
    return { ok: true, data: imported };
  } catch (error) {
    console.error("[importLocalInvestmentsAction]", error);
    return { ok: false, error: "ไม่สามารถนำเข้าแผนลงทุนเดิมได้" };
  }
}
