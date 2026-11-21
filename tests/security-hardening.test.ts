import { afterEach, describe, expect, it } from "vitest";
import {
  canOAuthSignIn,
  canRegisterEmail,
  escapeSqlLikePattern,
  getRegistrationUiMode,
  getSafeCallbackUrl,
  timingSafeStringEqual,
} from "@/lib/auth-policy";
import { moneyFlowBackupSchema } from "@/lib/portable-backup";
import {
  checkMemoryRateLimit,
  clearMemoryRateLimits,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";

afterEach(() => {
  clearMemoryRateLimits();
});

describe("auth-policy: registration & OAuth guards", () => {
  it("defaults to open registration when env vars are unset", () => {
    expect(getRegistrationUiMode({})).toBe("open");
    expect(
      canRegisterEmail({ email: "user@example.com", env: {} })
    ).toEqual({ allowed: true });
  });

  it("blocks public registration when ALLOW_PUBLIC_REGISTRATION=false", () => {
    const env = { ALLOW_PUBLIC_REGISTRATION: "false" };
    expect(getRegistrationUiMode(env)).toBe("closed");

    const res = canRegisterEmail({ email: "stranger@example.com", env });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.reason).toBe("closed");
    }
  });

  it("enforces invite code when REGISTRATION_INVITE_CODE is configured", () => {
    const env = {
      ALLOW_PUBLIC_REGISTRATION: "false",
      REGISTRATION_INVITE_CODE: "MF-SECRET-2026",
    };
    expect(getRegistrationUiMode(env)).toBe("invite_only");

    const wrong = canRegisterEmail({
      email: "friend@example.com",
      inviteCode: "wrong-code",
      env,
    });
    expect(wrong.allowed).toBe(false);
    if (!wrong.allowed) {
      expect(wrong.reason).toBe("invite_invalid");
    }

    const valid = canRegisterEmail({
      email: "friend@example.com",
      inviteCode: "MF-SECRET-2026",
      env,
    });
    expect(valid).toEqual({ allowed: true });
  });

  it("enforces ALLOWED_AUTH_EMAILS across email registration and Google OAuth", () => {
    const env = {
      ALLOW_PUBLIC_REGISTRATION: "false",
      REGISTRATION_INVITE_CODE: "INV123",
      ALLOWED_AUTH_EMAILS: "Owner@Example.com, family@example.com",
    };

    const blockedReg = canRegisterEmail({
      email: "other@example.com",
      inviteCode: "INV123",
      env,
    });
    expect(blockedReg.allowed).toBe(false);
    if (!blockedReg.allowed) {
      expect(blockedReg.reason).toBe("email_not_allowed");
    }

    expect(
      canRegisterEmail({
        email: "owner@example.com",
        inviteCode: "INV123",
        env,
      })
    ).toEqual({ allowed: true });

    expect(
      canOAuthSignIn({
        email: "owner@example.com",
        hasExistingAccount: false,
        env,
      })
    ).toBe(true);

    expect(
      canOAuthSignIn({
        email: "intruder@example.com",
        hasExistingAccount: true,
        env,
      })
    ).toBe(false);
  });

  it("allows existing OAuth users when registration is closed, but blocks new OAuth signups", () => {
    const closedEnv = { ALLOW_PUBLIC_REGISTRATION: "false" };
    expect(
      canOAuthSignIn({
        email: "existing@example.com",
        hasExistingAccount: true,
        env: closedEnv,
      })
    ).toBe(true);
    expect(
      canOAuthSignIn({
        email: "newcomer@example.com",
        hasExistingAccount: false,
        env: closedEnv,
      })
    ).toBe(false);
  });

  it("compares strings safely regardless of length", () => {
    expect(timingSafeStringEqual("abc123", "abc123")).toBe(true);
    expect(timingSafeStringEqual("abc123", "abc124")).toBe(false);
    expect(timingSafeStringEqual("short", "much-longer-secret")).toBe(false);
  });
});

describe("getSafeCallbackUrl: open redirect defense", () => {
  it("preserves safe same-origin relative paths", () => {
    expect(getSafeCallbackUrl("/")).toBe("/");
    expect(getSafeCallbackUrl("/transactions?type=expense#top")).toBe(
      "/transactions?type=expense#top"
    );
    expect(getSafeCallbackUrl("/plan")).toBe("/plan");
  });

  it("rejects protocol-relative, backslash, absolute URLs, and control chars", () => {
    expect(getSafeCallbackUrl("//evil.example")).toBe("/");
    expect(getSafeCallbackUrl("/\\evil.example")).toBe("/");
    expect(getSafeCallbackUrl("/\\/evil.example")).toBe("/");
    expect(getSafeCallbackUrl("https://evil.example/phish")).toBe("/");
    expect(getSafeCallbackUrl("javascript:alert(1)")).toBe("/");
    expect(getSafeCallbackUrl("/plan\r\nX-Injected: 1")).toBe("/");
    expect(getSafeCallbackUrl("/\tplan")).toBe("/");
    expect(getSafeCallbackUrl(null)).toBe("/");
  });
});

describe("escapeSqlLikePattern", () => {
  it("escapes %, _, and backslash characters", () => {
    expect(escapeSqlLikePattern("50%_discount\\test")).toBe(
      "50\\%\\_discount\\\\test"
    );
    expect(escapeSqlLikePattern("ค่ากาแฟ 65 บาท")).toBe("ค่ากาแฟ 65 บาท");
  });
});

describe("portable-backup payload size caps", () => {
  it("rejects backup payloads exceeding max wallet count", () => {
    const oversizedWallets = Array.from({ length: 101 }, (_, i) => ({
      id: `w-${i}`,
      name: `Wallet ${i}`,
      type: "cash" as const,
      initialBalance: "0.00",
      color: "#0f766e",
      icon: null,
      isArchived: false,
    }));

    const parsed = moneyFlowBackupSchema.safeParse({
      app: "MoneyFlow",
      version: 1,
      exportedAt: "2026-11-20T00:00:00.000Z",
      wallets: oversizedWallets,
      categories: [
        {
          id: "c-1",
          name: "อาหาร",
          type: "expense",
          monthlyBudget: null,
          color: "#ef4444",
          icon: null,
          isDefault: true,
          isArchived: false,
        },
      ],
      salarySettings: null,
      salaryAllocations: [],
      transactions: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("rate-limit: memory limiter & client IP extraction", () => {
  it("enforces window limit and resets after expiry", () => {
    const t0 = 1_700_000_000_000;
    const r1 = checkMemoryRateLimit({
      key: "test:ip:1",
      limit: 2,
      windowMs: 10_000,
      now: t0,
    });
    const r2 = checkMemoryRateLimit({
      key: "test:ip:1",
      limit: 2,
      windowMs: 10_000,
      now: t0 + 1_000,
    });
    const r3 = checkMemoryRateLimit({
      key: "test:ip:1",
      limit: 2,
      windowMs: 10_000,
      now: t0 + 2_000,
    });

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterSec).toBe(8);

    const rAfterReset = checkMemoryRateLimit({
      key: "test:ip:1",
      limit: 2,
      windowMs: 10_000,
      now: t0 + 10_001,
    });
    expect(rAfterReset.allowed).toBe(true);
    expect(rAfterReset.remaining).toBe(1);
  });

  it("extracts client IP safely from proxy headers", () => {
    expect(
      getClientIpFromHeaders(
        new Headers({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "10.0.0.1" })
      )
    ).toBe("203.0.113.5");
    expect(
      getClientIpFromHeaders(
        new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" })
      )
    ).toBe("198.51.100.7");
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
