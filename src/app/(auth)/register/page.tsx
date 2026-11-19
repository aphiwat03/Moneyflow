import type { Metadata } from "next";
import { isGoogleAuthEnabled } from "@/auth.config";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = {
  title: "สมัครใช้งาน",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <RegisterForm googleEnabled={isGoogleAuthEnabled} />
    </main>
  );
}
