"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { ActionResult, CategoryType } from "@/lib/types";
import { categorySchema } from "@/lib/validations";

function revalidateAllMoneyViews() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/manage");
  revalidatePath("/plan");
}

export async function createCategoryAction(input: {
  name: string;
  type: CategoryType;
  monthlyBudget?: string | null;
  color?: string | null;
  icon?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลหมวดหมู่ไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const [created] = await db
      .insert(categories)
      .values({
        userId: user.id,
        name: parsed.data.name,
        type: parsed.data.type,
        monthlyBudget: parsed.data.monthlyBudget,
        color: parsed.data.color ?? "#64748b",
        icon: parsed.data.icon ?? "Tag",
        isDefault: false,
      })
      .returning({ id: categories.id });

    revalidateAllMoneyViews();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    console.error("createCategoryAction error:", error);
    return { ok: false, error: "ไม่สามารถสร้างหมวดหมู่ได้" };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  input: {
    name: string;
    type: CategoryType;
    monthlyBudget?: string | null;
    color?: string | null;
    icon?: string | null;
  }
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลหมวดหมู่ไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const [existing] = await db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)))
      .limit(1);

    if (!existing) {
      return { ok: false, error: "ไม่พบหมวดหมู่ที่ต้องการแก้ไข" };
    }

    if (existing.type !== parsed.data.type) {
      return {
        ok: false,
        error: "ไม่สามารถเปลี่ยนประเภท (รายรับ/รายจ่าย) ของหมวดหมู่ที่มีอยู่ได้",
      };
    }

    await db
      .update(categories)
      .set({
        name: parsed.data.name,
        monthlyBudget: parsed.data.monthlyBudget,
        color: parsed.data.color ?? "#64748b",
        icon: parsed.data.icon ?? "Tag",
      })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)));

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("updateCategoryAction error:", error);
    return { ok: false, error: "ไม่สามารถแก้ไขหมวดหมู่ได้" };
  }
}

export async function toggleArchiveCategoryAction(
  categoryId: string,
  isArchived: boolean
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const updated = await db
      .update(categories)
      .set({ isArchived })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)))
      .returning({ id: categories.id });

    if (updated.length === 0) {
      return { ok: false, error: "ไม่พบหมวดหมู่" };
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("toggleArchiveCategoryAction error:", error);
    return { ok: false, error: "ไม่สามารถอัปเดตสถานะหมวดหมู่ได้" };
  }
}

export async function deleteCategoryAction(
  categoryId: string
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(eq(categories.id, categoryId), eq(categories.userId, user.id))
        )
        .for("update");

      if (!existing) {
        return { ok: false as const, error: "ไม่พบหมวดหมู่ที่ต้องการลบ" };
      }

      const [txRef] = await tx
        .select({ total: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            eq(transactions.categoryId, categoryId)
          )
        );

      if ((txRef?.total ?? 0) > 0) {
        return {
          ok: false as const,
          error: `ไม่สามารถลบหมวดหมู่นี้ได้เนื่องจากมีรายการผูกอยู่ ${txRef.total} รายการ กรุณาใช้การซ่อน (Archive) แทน`,
        };
      }

      await tx
        .delete(categories)
        .where(
          and(eq(categories.id, categoryId), eq(categories.userId, user.id))
        );

      return { ok: true as const };
    });

    if (!result.ok) {
      return result;
    }

    revalidateAllMoneyViews();
    return { ok: true };
  } catch (error) {
    console.error("deleteCategoryAction error:", error);
    return { ok: false, error: "ไม่สามารถลบหมวดหมู่ได้" };
  }
}
