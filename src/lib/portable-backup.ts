import Decimal from "decimal.js";
import * as z from "zod";
import type {
  CategoryDTO,
  SalaryAllocationDTO,
  SalarySettingsDTO,
  TransactionDTO,
  WalletDTO,
} from "./types";
import {
  CATEGORY_TYPES,
  isoDateSchema,
  nonNegativeMoneyStringSchema,
  PLAN_ALLOCATION_MODES,
  PLAN_BUCKET_TYPES,
  positiveMoneyStringSchema,
  signedMoneyStringSchema,
  TRANSACTION_TYPES,
  WALLET_TYPES,
} from "./validations";

const backupIdSchema = z.string().trim().min(1).max(100);
const nullableBackupIdSchema = backupIdSchema
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const backupWalletSchema = z
  .object({
    id: backupIdSchema,
    name: z.string().trim().min(1).max(100),
    type: z.enum(WALLET_TYPES),
    initialBalance: signedMoneyStringSchema.default("0.00"),
    color: z.string().trim().max(20).optional().nullable().default("#0f766e"),
    icon: z.string().trim().max(50).optional().nullable().default("Wallet"),
    isArchived: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (
      (data.type === "cash" ||
        data.type === "ewallet" ||
        data.type === "savings_goal" ||
        data.type === "investment") &&
      new Decimal(data.initialBalance).isNegative()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["initialBalance"],
        message: "ยอดเริ่มต้นของเงินสด E-Wallet กระเป๋าเป้าหมาย หรือพอร์ตลงทุน ต้องไม่ติดลบ",
      });
    }
  });

const backupCategorySchema = z
  .object({
    id: backupIdSchema,
    name: z.string().trim().min(1).max(100),
    type: z.enum(CATEGORY_TYPES),
    monthlyBudget: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v && v.length > 0 ? v : null)),
    color: z.string().trim().max(20).optional().nullable().default("#64748b"),
    icon: z.string().trim().max(50).optional().nullable().default("Tag"),
    isDefault: z.boolean().default(false),
    isArchived: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.monthlyBudget !== null) {
      if (data.type !== "expense") {
        ctx.addIssue({
          code: "custom",
          path: ["monthlyBudget"],
          message: "งบประมาณรายเดือนกำหนดได้เฉพาะหมวดหมู่รายจ่ายเท่านั้น",
        });
        return;
      }
      const checkBudget = positiveMoneyStringSchema.safeParse(data.monthlyBudget);
      if (!checkBudget.success) {
        ctx.addIssue({
          code: "custom",
          path: ["monthlyBudget"],
          message: "งบประมาณรายเดือนไม่ถูกต้อง",
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    monthlyBudget:
      data.monthlyBudget !== null
        ? new Decimal(data.monthlyBudget).toFixed(2)
        : null,
  }));

const backupSalarySettingsSchema = z.object({
  monthlySalary: nonNegativeMoneyStringSchema,
  extraIncome: nonNegativeMoneyStringSchema.default("0.00"),
  payday: z.number().int().min(1).max(31),
  salaryWalletId: nullableBackupIdSchema,
});

const backupAllocationSchema = z
  .object({
    id: backupIdSchema,
    name: z.string().trim().min(1).max(100),
    bucketType: z.enum(PLAN_BUCKET_TYPES),
    mode: z.enum(PLAN_ALLOCATION_MODES),
    value: positiveMoneyStringSchema,
    targetTotal: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v && v.length > 0 ? v : null)),
    targetMonths: z.number().int().min(1).max(600).optional().nullable().default(null),
    linkedWalletId: nullableBackupIdSchema,
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "percent" && new Decimal(data.value).gt(100)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "สัดส่วนเปอร์เซ็นต์ต้องไม่เกิน 100%",
      });
    }
    if (data.targetTotal !== null) {
      const checkTotal = positiveMoneyStringSchema.safeParse(data.targetTotal);
      if (!checkTotal.success) {
        ctx.addIssue({
          code: "custom",
          path: ["targetTotal"],
          message: "ราคาเป้าหมายไม่ถูกต้อง",
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    targetTotal:
      data.targetTotal !== null
        ? new Decimal(data.targetTotal).toFixed(2)
        : null,
  }));

const backupTransactionSchema = z.object({
  id: backupIdSchema,
  type: z.enum(TRANSACTION_TYPES),
  walletId: backupIdSchema,
  toWalletId: nullableBackupIdSchema,
  categoryId: nullableBackupIdSchema,
  amount: positiveMoneyStringSchema,
  transactionDate: isoDateSchema,
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const moneyFlowBackupSchema = z
  .object({
    app: z.literal("MoneyFlow"),
    version: z.literal(1),
    exportedAt: z.string().min(1),
    wallets: z.array(backupWalletSchema).min(1, "ไฟล์สำรองต้องมีกระเป๋าเงินอย่างน้อย 1 รายการ"),
    categories: z.array(backupCategorySchema).min(1, "ไฟล์สำรองต้องมีหมวดหมู่อย่างน้อย 1 รายการ"),
    salarySettings: backupSalarySettingsSchema.nullable().default(null),
    salaryAllocations: z.array(backupAllocationSchema).default([]),
    transactions: z.array(backupTransactionSchema).default([]),
  })
  .superRefine((bundle, ctx) => {
    const walletIds = new Set<string>();
    for (let i = 0; i < bundle.wallets.length; i += 1) {
      const w = bundle.wallets[i];
      if (walletIds.has(w.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["wallets", i, "id"],
          message: `พบรหัสกระเป๋าเงินซ้ำ: ${w.id}`,
        });
      }
      walletIds.add(w.id);
    }

    const categoryMap = new Map<string, "income" | "expense">();
    for (let i = 0; i < bundle.categories.length; i += 1) {
      const c = bundle.categories[i];
      if (categoryMap.has(c.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["categories", i, "id"],
          message: `พบรหัสหมวดหมู่ซ้ำ: ${c.id}`,
        });
      }
      categoryMap.set(c.id, c.type);
    }

    if (
      bundle.salarySettings?.salaryWalletId &&
      !walletIds.has(bundle.salarySettings.salaryWalletId)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["salarySettings", "salaryWalletId"],
        message: "กระเป๋ารับเงินเดือนในไฟล์สำรองไม่พบในรายการกระเป๋าเงิน",
      });
    }

    for (let i = 0; i < bundle.salaryAllocations.length; i += 1) {
      const alloc = bundle.salaryAllocations[i];
      if (alloc.linkedWalletId && !walletIds.has(alloc.linkedWalletId)) {
        ctx.addIssue({
          code: "custom",
          path: ["salaryAllocations", i, "linkedWalletId"],
          message: `กระเป๋าเป้าหมายของ "${alloc.name}" ไม่พบในรายการกระเป๋าเงิน`,
        });
      }
    }

    for (let i = 0; i < bundle.transactions.length; i += 1) {
      const tx = bundle.transactions[i];
      if (!walletIds.has(tx.walletId)) {
        ctx.addIssue({
          code: "custom",
          path: ["transactions", i, "walletId"],
          message: `รายการที่ ${i + 1}: ไม่พบกระเป๋าเงินต้นทาง`,
        });
      }

      if (tx.type === "transfer") {
        if (!tx.toWalletId || !walletIds.has(tx.toWalletId)) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions", i, "toWalletId"],
            message: `รายการที่ ${i + 1}: ไม่พบกระเป๋าเงินปลายทาง`,
          });
        } else if (tx.toWalletId === tx.walletId) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions", i, "toWalletId"],
            message: `รายการที่ ${i + 1}: กระเป๋าต้นทางและปลายทางซ้ำกัน`,
          });
        }
        if (tx.categoryId !== null) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions", i, "categoryId"],
            message: `รายการที่ ${i + 1}: รายการโอนย้ายต้องไม่มีหมวดหมู่`,
          });
        }
      } else {
        if (tx.toWalletId !== null) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions", i, "toWalletId"],
            message: `รายการที่ ${i + 1}: รายรับ/รายจ่ายต้องไม่มีกระเป๋าปลายทาง`,
          });
        }
        const catType = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        if (!catType) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions", i, "categoryId"],
            message: `รายการที่ ${i + 1}: ไม่พบหมวดหมู่`,
          });
        } else if (catType !== tx.type) {
          ctx.addIssue({
            code: "custom",
            path: ["transactions", i, "categoryId"],
            message: `รายการที่ ${i + 1}: ประเภทหมวดหมู่ไม่ตรงกับประเภทรายการ`,
          });
        }
      }
    }
  });

export type MoneyFlowBackupBundle = z.infer<typeof moneyFlowBackupSchema>;

export function createBackupBundle(params: {
  wallets: Array<Omit<WalletDTO, "currentBalance">>;
  categories: CategoryDTO[];
  salarySettings: SalarySettingsDTO | null;
  salaryAllocations: SalaryAllocationDTO[];
  transactions: Array<
    Pick<
      TransactionDTO,
      | "id"
      | "type"
      | "walletId"
      | "toWalletId"
      | "categoryId"
      | "amount"
      | "transactionDate"
      | "note"
    >
  >;
  exportedAt?: string;
}): MoneyFlowBackupBundle {
  return moneyFlowBackupSchema.parse({
    app: "MoneyFlow",
    version: 1,
    exportedAt: params.exportedAt ?? new Date().toISOString(),
    wallets: params.wallets.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      initialBalance: w.initialBalance,
      color: w.color,
      icon: w.icon,
      isArchived: w.isArchived,
    })),
    categories: params.categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      monthlyBudget: c.monthlyBudget,
      color: c.color,
      icon: c.icon,
      isDefault: c.isDefault,
      isArchived: c.isArchived,
    })),
    salarySettings: params.salarySettings
      ? {
          monthlySalary: params.salarySettings.monthlySalary,
          extraIncome: params.salarySettings.extraIncome ?? "0.00",
          payday: params.salarySettings.payday,
          salaryWalletId: params.salarySettings.salaryWalletId,
        }
      : null,
    salaryAllocations: params.salaryAllocations.map((a) => ({
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
    transactions: params.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      walletId: t.walletId,
      toWalletId: t.toWalletId,
      categoryId: t.categoryId,
      amount: t.amount,
      transactionDate: t.transactionDate,
      note: t.note,
    })),
  });
}

export function parseBackupBundle(
  raw: unknown
): { ok: true; data: MoneyFlowBackupBundle } | { ok: false; error: string } {
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, error: "ไฟล์ไม่ใช่รูปแบบ JSON ที่ถูกต้อง" };
    }
  }

  const parsed = moneyFlowBackupSchema.safeParse(obj);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      error: firstIssue?.message || "โครงสร้างไฟล์สำรองข้อมูลไม่ถูกต้อง",
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Generates fresh UUIDs for all records in a backup bundle while preserving
 * all internal relational references (wallets, categories, settings, allocations, transactions).
 */
export function remapBackupBundleIds(
  bundle: MoneyFlowBackupBundle
): MoneyFlowBackupBundle {
  const walletIdMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();

  const wallets = bundle.wallets.map((w) => {
    const nextId = crypto.randomUUID();
    walletIdMap.set(w.id, nextId);
    return { ...w, id: nextId };
  });

  const categories = bundle.categories.map((c) => {
    const nextId = crypto.randomUUID();
    categoryIdMap.set(c.id, nextId);
    return { ...c, id: nextId };
  });

  const salarySettings = bundle.salarySettings
    ? {
        ...bundle.salarySettings,
        salaryWalletId: bundle.salarySettings.salaryWalletId
          ? (walletIdMap.get(bundle.salarySettings.salaryWalletId) ?? null)
          : null,
      }
    : null;

  const salaryAllocations = bundle.salaryAllocations.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    linkedWalletId: a.linkedWalletId
      ? (walletIdMap.get(a.linkedWalletId) ?? null)
      : null,
  }));

  const transactions = bundle.transactions.map((tx) => ({
    ...tx,
    id: crypto.randomUUID(),
    walletId: walletIdMap.get(tx.walletId) ?? tx.walletId,
    toWalletId: tx.toWalletId
      ? (walletIdMap.get(tx.toWalletId) ?? null)
      : null,
    categoryId: tx.categoryId
      ? (categoryIdMap.get(tx.categoryId) ?? null)
      : null,
  }));

  return {
    ...bundle,
    wallets,
    categories,
    salarySettings,
    salaryAllocations,
    transactions,
  };
}
