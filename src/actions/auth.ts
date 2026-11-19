"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { seedDefaultDataForUser } from "@/db/seed";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/lib/validations";

export interface AuthActionState {
  error?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
}

function getSafeCallbackUrl(rawCallbackUrl: FormDataEntryValue | null): string {
  if (typeof rawCallbackUrl !== "string") return "/";
  if (!rawCallbackUrl.startsWith("/") || rawCallbackUrl.startsWith("//")) {
    return "/";
  }
  return rawCallbackUrl;
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return {
        error: "อีเมลนี้มีบัญชีผู้ใช้อยู่แล้ว กรุณาเข้าสู่ระบบ",
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
        })
        .returning({ id: users.id });

      await seedDefaultDataForUser(tx, created.id);
    });
  } catch (error) {
    console.error("Failed to register user:", error);
    return {
      error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการตั้งค่า DATABASE_URL",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "สมัครสมาชิกสำเร็จ แต่เข้าสู่ระบบอัตโนมัติไม่สำเร็จ" };
    }
    throw error;
  }

  return {};
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const redirectTo = getSafeCallbackUrl(formData.get("callbackUrl"));

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
      }
      return { error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง" };
    }
    throw error;
  }

  return {};
}

export async function loginWithGoogleAction() {
  await signIn("google", { redirectTo: "/" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function updateProfileAction(input: {
  name: string;
}): Promise<ActionResult<{ name: string }>> {
  const user = await requireUser();
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, user.id));

    revalidatePath("/");
    revalidatePath("/manage");
    revalidatePath("/plan");
    return { ok: true, data: { name: parsed.data.name } };
  } catch (error) {
    console.error("updateProfileAction error:", error);
    return { ok: false, error: "ไม่สามารถอัปเดตชื่อโปรไฟล์ได้" };
  }
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "ข้อมูลรหัสผ่านไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const [record] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!record) {
      return { ok: false, error: "ไม่พบบัญชีผู้ใช้งาน" };
    }

    if (record.passwordHash) {
      const matches = await bcrypt.compare(
        parsed.data.currentPassword,
        record.passwordHash
      );
      if (!matches) {
        return { ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
      }
    }

    const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash: nextHash })
      .where(eq(users.id, user.id));

    return { ok: true };
  } catch (error) {
    console.error("changePasswordAction error:", error);
    return { ok: false, error: "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
  }
}
