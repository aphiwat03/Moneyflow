import { createHash, timingSafeEqual } from "node:crypto";

export interface AuthPolicyEnv {
  ALLOW_PUBLIC_REGISTRATION?: string;
  REGISTRATION_INVITE_CODE?: string;
  ALLOWED_AUTH_EMAILS?: string;
  [key: string]: string | undefined;
}

export type RegistrationUiMode = "open" | "invite_only" | "closed";

export function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a, "utf8").digest();
  const hashB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(hashA, hashB);
}

export function isPublicRegistrationAllowed(
  env: AuthPolicyEnv = process.env
): boolean {
  const raw = env.ALLOW_PUBLIC_REGISTRATION?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  return true;
}

export function getRegistrationInviteCode(
  env: AuthPolicyEnv = process.env
): string | null {
  const code = env.REGISTRATION_INVITE_CODE?.trim();
  return code && code.length > 0 ? code : null;
}

export function getAllowedAuthEmails(
  env: AuthPolicyEnv = process.env
): Set<string> {
  const raw = env.ALLOWED_AUTH_EMAILS?.trim();
  if (!raw) return new Set();
  const emails = raw
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0 && item.includes("@"));
  return new Set(emails);
}

export function getRegistrationUiMode(
  env: AuthPolicyEnv = process.env
): RegistrationUiMode {
  if (getRegistrationInviteCode(env)) {
    return "invite_only";
  }
  if (!isPublicRegistrationAllowed(env)) {
    return "closed";
  }
  return "open";
}

export function canRegisterEmail(params: {
  email: string;
  inviteCode?: string | null;
  env?: AuthPolicyEnv;
}):
  | { allowed: true }
  | {
      allowed: false;
      reason: "closed" | "invite_invalid" | "email_not_allowed";
      message: string;
    } {
  const env = params.env ?? process.env;
  const normalizedEmail = params.email.trim().toLowerCase();
  const inviteCode = getRegistrationInviteCode(env);
  const allowedEmails = getAllowedAuthEmails(env);
  const publicAllowed = isPublicRegistrationAllowed(env);

  if (inviteCode) {
    const provided = (params.inviteCode ?? "").trim();
    if (!provided || !timingSafeStringEqual(provided, inviteCode)) {
      return {
        allowed: false,
        reason: "invite_invalid",
        message: "รหัสเชิญไม่ถูกต้อง กรุณาตรวจสอบกับผู้ดูแลระบบ",
      };
    }
  } else if (!publicAllowed) {
    return {
      allowed: false,
      reason: "closed",
      message: "ระบบปิดรับสมัครสมาชิกสาธารณะในขณะนี้",
    };
  }

  if (allowedEmails.size > 0 && !allowedEmails.has(normalizedEmail)) {
    return {
      allowed: false,
      reason: "email_not_allowed",
      message: "อีเมลนี้ยังไม่ได้รับอนุญาตให้สมัครใช้งานระบบ",
    };
  }

  return { allowed: true };
}

export function canOAuthSignIn(params: {
  email: string | null | undefined;
  hasExistingAccount: boolean;
  env?: AuthPolicyEnv;
}): boolean {
  const env = params.env ?? process.env;
  const normalizedEmail = params.email?.trim().toLowerCase() ?? "";
  if (!normalizedEmail) {
    return false;
  }

  const allowedEmails = getAllowedAuthEmails(env);
  if (allowedEmails.size > 0 && !allowedEmails.has(normalizedEmail)) {
    return false;
  }

  if (params.hasExistingAccount) {
    return true;
  }

  if (allowedEmails.size > 0) {
    return allowedEmails.has(normalizedEmail);
  }

  if (getRegistrationInviteCode(env) !== null) {
    return false;
  }

  return isPublicRegistrationAllowed(env);
}

/**
 * Ensures post-login redirects stay strictly on the same origin.
 * Rejects protocol-relative URLs (//evil.com), backslash tricks (/\evil.com),
 * absolute URLs, and control characters.
 */
export function getSafeCallbackUrl(rawCallbackUrl: unknown): string {
  if (typeof rawCallbackUrl !== "string") return "/";
  const trimmed = rawCallbackUrl.trim();
  if (!trimmed) return "/";
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return "/";
  if (trimmed.includes("\\")) return "/";
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";

  try {
    const baseOrigin = "http://moneyflow.local";
    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.origin !== baseOrigin) return "/";
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

/**
 * Escapes PostgreSQL LIKE/ILIKE wildcard characters (%, _, \) so user search
 * queries match literally without unintended wildcard expansion.
 */
export function escapeSqlLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (match) => `\\${match}`);
}
