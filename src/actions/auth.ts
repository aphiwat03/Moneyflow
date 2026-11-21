"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { seedDefaultDataForUser } from "@/db/seed";
import { canRegisterEmail, getSafeCallbackUrl } from "@/lib/auth-policy";
import {
  consumeDbRateLimit,
  getClientIpFromHeaders,
  getDbRateLimitStatus,
  recordDbRateLimitHit,
  resetDbRateLimit,
} from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/lib/validations";

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_FAILURES_PER_ACCOUNT = 10;
const LOGIN_MAX_FAILURES_PER_IP = 30;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REGISTER_MAX_ATTEMPTS_PER_IP = 5;

export interface AuthActionState {
  error?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    inviteCode?: string[];
  };
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawInviteCode = formData.get("inviteCode");
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
  const inviteCode = typeof rawInviteCode === "string" ? rawInviteCode : null;

  const reqHeaders = await headers();
  const clientIp = getClientIpFromHeaders(reqHeaders);
  const registerLimit = await consumeDbRateLimit({
    key: `register:ip:${clientIp}`,
    limit: REGISTER_MAX_ATTEMPTS_PER_IP,
    windowMs: REGISTER_WINDOW_MS,
  });

  if (!registerLimit.allowed) {
    return {
      error: "มีการพยายามสมัครสมาชิกหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
    };
  }

  const policyCheck = canRegisterEmail({ email, inviteCode });
  if (!policyCheck.allowed) {
    if (policyCheck.reason === "invite_invalid") {
      return {
        error: policyCheck.message,
        fieldErrors: { inviteCode: [policyCheck.message] },
      };
    }
    return { error: policyCheck.message };
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return {
        error: "ไม่สามารถสร้างบัญชีด้วยอีเมลนี้ได้ หากมีบัญชีอยู่แล้วกรุณาเข้าสู่ระบบ",
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
      error: "ไม่สามารถสร้างบัญชีได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง",
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

  const reqHeaders = await headers();
  const clientIp = getClientIpFromHeaders(reqHeaders);
  const accountRateKey = `login:acct:${clientIp}:${parsed.data.email}`;
  const ipRateKey = `login:ip:${clientIp}`;

  const [acctStatus, ipStatus] = await Promise.all([
    getDbRateLimitStatus({
      key: accountRateKey,
      limit: LOGIN_MAX_FAILURES_PER_ACCOUNT,
    }),
    getDbRateLimitStatus({
      key: ipRateKey,
      limit: LOGIN_MAX_FAILURES_PER_IP,
    }),
  ]);

  if (!acctStatus.allowed || !ipStatus.allowed) {
    const waitMinutes = Math.max(
      1,
      Math.ceil(Math.max(acctStatus.retryAfterSec, ipStatus.retryAfterSec) / 60)
    );
    return {
      error: `เข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอประมาณ ${waitMinutes} นาทีแล้วลองใหม่`,
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
        await Promise.all([
          recordDbRateLimitHit({
            key: accountRateKey,
            windowMs: LOGIN_WINDOW_MS,
          }),
          recordDbRateLimitHit({
            key: ipRateKey,
            windowMs: LOGIN_WINDOW_MS,
          }),
        ]);
        return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
      }
      return { error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง" };
    }
    // Successful login triggers Next.js NEXT_REDIRECT error — reset account failure bucket first.
    await resetDbRateLimit(accountRateKey);
    throw error;
  }

  await resetDbRateLimit(accountRateKey);
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
}): Promise<ActionResult<{ signedOut: boolean }>> {
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

    if (!record.passwordHash) {
      return {
        ok: false,
        error: "บัญชีนี้เข้าสู่ระบบด้วย Google กรุณาจัดการรหัสผ่านผ่านบัญชี Google ของคุณ",
      };
    }

    const matches = await bcrypt.compare(
      parsed.data.currentPassword,
      record.passwordHash
    );
    if (!matches) {
      return { ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }

    const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(users)
      .set({
        passwordHash: nextHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, user.id));

    // Revoke current browser's JWT cookie cleanly alongside all other devices via tokenVersion.
    await signOut({ redirect: false });
    return { ok: true, data: { signedOut: true } };
  } catch (error) {
    console.error("changePasswordAction error:", error);
    return { ok: false, error: "ไม่สามารถเปลี่ยนรหัสผ่านได้" };
  }
}
