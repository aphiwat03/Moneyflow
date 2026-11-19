import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/auth.config";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <Suspense
        fallback={
          <div className="h-96 w-full max-w-md animate-pulse rounded-xl bg-muted" />
        }
      >
        <LoginForm googleEnabled={isGoogleAuthEnabled} />
      </Suspense>
    </main>
  );
}
