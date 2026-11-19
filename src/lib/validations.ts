import Decimal from "decimal.js";
import * as z from "zod";
import { isValidIsoCalendarDate } from "./date";

export const WALLET_TYPES = [
  "cash",
  "bank",
  "credit_card",
  "ewallet",
  "savings_goal",
  "investment",
] as const;
export const CATEGORY_TYPES = ["income", "expense"] as const;
export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;
export const PLAN_BUCKET_TYPES = [
  "cold_money",
  "dca",
  "wishlist",
  "other",
] as const;
export const PLAN_ALLOCATION_MODES = ["fixed", "percent"] as const;

const MAX_NUMERIC_12_2 = new Decimal("9999999999.99");
const MIN_NUMERIC_12_2 = new Decimal("-9999999999.99");

export const positiveMoneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "กรุณากรอกจำนวนเงินเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง")
  .refine((val) => {
    const d = new Decimal(val);
    return d.gt(0) && d.lte(MAX_NUMERIC_12_2);
  }, "จำนวนเงินต้องมากกว่า 0 และไม่เกิน 9,999,999,999.99")
  .transform((val) => new Decimal(val).toFixed(2));

export const nonNegativeMoneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "กรุณากรอกจำนวนเงินเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง")
  .refine((val) => {
    const d = new Decimal(val);
    return d.gte(0) && d.lte(MAX_NUMERIC_12_2);
  }, "จำนวนเงินต้องตั้งแต่ 0 ขึ้นไป และไม่เกิน 9,999,999,999.99")
  .transform((val) => {
    const d = new Decimal(val);
    return d.isZero() ? "0.00" : d.toFixed(2);
  });

export const signedMoneyStringSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "กรุณากรอกยอดเงินเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง")
  .refine((val) => {
    const d = new Decimal(val);
    return d.gte(MIN_NUMERIC_12_2) && d.lte(MAX_NUMERIC_12_2);
  }, "ยอดเงินเกินขอบเขตที่ระบบรองรับ")
  .transform((val) => {
    const d = new Decimal(val);
    return d.isZero() ? "0.00" : d.toFixed(2);
  });

export const isoDateSchema = z
  .string()
  .trim()
  .refine(isValidIsoCalendarDate, "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");

export const walletSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "กรุณาระบุชื่อกระเป๋าเงิน")
      .max(100, "ชื่อกระเป๋าเงินต้องไม่เกิน 100 ตัวอักษร"),
    type: z.enum(WALLET_TYPES),
    initialBalance: signedMoneyStringSchema.default("0.00"),
    color: z.string().trim().max(20).optional().nullable(),
    icon: z.string().trim().max(50).optional().nullable(),
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

export const categorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "กรุณาระบุชื่อหมวดหมู่")
      .max(100, "ชื่อหมวดหมู่ต้องไม่เกิน 100 ตัวอักษร"),
    type: z.enum(CATEGORY_TYPES),
    monthlyBudget: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v && v.length > 0 ? v : null)),
    color: z.string().trim().max(20).optional().nullable(),
    icon: z.string().trim().max(50).optional().nullable(),
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
      const parsed = positiveMoneyStringSchema.safeParse(data.monthlyBudget);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["monthlyBudget"],
          message:
            parsed.error.issues[0]?.message ??
            "งบประมาณรายเดือนต้องเป็นตัวเลขมากกว่า 0",
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

export const adjustWalletBalanceSchema = z.object({
  walletId: z.string().uuid("รหัสกระเป๋าเงินไม่ถูกต้อง"),
  actualBalance: signedMoneyStringSchema,
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(80, "ชื่อต้องไม่เกิน 80 ตัวอักษร"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z
      .string()
      .min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
      .max(128, "รหัสผ่านใหม่ต้องไม่เกิน 128 ตัวอักษร"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่านใหม่"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "รหัสผ่านยืนยันไม่ตรงกัน",
      });
    }
  });

export const salarySettingsSchema = z.object({
  monthlySalary: nonNegativeMoneyStringSchema,
  extraIncome: nonNegativeMoneyStringSchema.default("0.00"),
  payday: z.coerce
    .number()
    .int("วันที่เงินออกต้องเป็นจำนวนเต็ม")
    .min(1, "วันที่เงินออกต้องอยู่ระหว่าง 1 ถึง 31")
    .max(31, "วันที่เงินออกต้องอยู่ระหว่าง 1 ถึง 31"),
  salaryWalletId: z
    .string()
    .uuid("รหัสกระเป๋าเงินไม่ถูกต้อง")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export const salaryAllocationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "กรุณาระบุชื่อเป้าหมาย / ก้อนเงินออม")
      .max(100, "ชื่อเป้าหมายต้องไม่เกิน 100 ตัวอักษร"),
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
    targetMonths: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((v) => {
        if (v === null || v === undefined || v === "") return null;
        return Number(v);
      }),
    linkedWalletId: z
      .string()
      .uuid("รหัสกระเป๋าเงินที่ผูกไม่ถูกต้อง")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
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
          message:
            checkTotal.error.issues[0]?.message ??
            "ราคาเป้าหมายต้องเป็นตัวเลขมากกว่า 0",
        });
      }
    }

    if (data.targetMonths !== null) {
      if (
        !Number.isInteger(data.targetMonths) ||
        data.targetMonths < 1 ||
        data.targetMonths > 600
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["targetMonths"],
          message: "จำนวนเดือนต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 600 เดือน",
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

export const transactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    walletId: z.string().uuid("รหัสกระเป๋าเงินไม่ถูกต้อง"),
    toWalletId: z
      .string()
      .uuid("รหัสกระเป๋าเงินปลายทางไม่ถูกต้อง")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    categoryId: z
      .string()
      .uuid("รหัสหมวดหมู่ไม่ถูกต้อง")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    amount: positiveMoneyStringSchema,
    transactionDate: isoDateSchema,
    note: z
      .string()
      .trim()
      .max(1000, "หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร")
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
      if (!data.toWalletId) {
        ctx.addIssue({
          code: "custom",
          path: ["toWalletId"],
          message: "กรุณาเลือกกระเป๋าเงินปลายทางสำหรับการโอนย้าย",
        });
      } else if (data.toWalletId === data.walletId) {
        ctx.addIssue({
          code: "custom",
          path: ["toWalletId"],
          message: "กระเป๋าต้นทางและปลายทางต้องไม่ซ้ำกัน",
        });
      }
      if (data.categoryId !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["categoryId"],
          message: "รายการโอนย้ายระหว่างบัญชีไม่ควรระบุหมวดหมู่",
        });
      }
    } else {
      if (!data.categoryId) {
        ctx.addIssue({
          code: "custom",
          path: ["categoryId"],
          message: "กรุณาเลือกหมวดหมู่",
        });
      }
      if (data.toWalletId !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["toWalletId"],
          message: "รายการรายรับหรือรายจ่ายไม่ควรระบุกระเป๋าปลายทาง",
        });
      }
    }
  });

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(80, "ชื่อต้องไม่เกิน 80 ตัวอักษร"),
  email: z
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(128, "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร"),
});

export const loginSchema = z.object({
  email: z.email("รูปแบบอีเมลไม่ถูกต้อง").trim().toLowerCase(),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});
