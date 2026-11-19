"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Wallet } from "lucide-react";
import {
  loginAction,
  loginWithGoogleAction,
  registerAction,
  type AuthActionState,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const INITIAL_STATE: AuthActionState = {};

export function LoginForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_STATE
  );

  return (
    <Card className="animate-mf-fade-up w-full max-w-md shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl font-semibold">เข้าสู่ระบบ MoneyFlow</CardTitle>
        <CardDescription>
          บันทึกรายรับ-รายจ่าย เชื่อมต่อฐานข้อมูลเดียวทั้งมือถือและ PC
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.error ? (
          <div
            role="alert"
            className="animate-mf-fade-up rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <div className="space-y-1.5">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
            {state.fieldErrors?.email?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.email[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
            {state.fieldErrors?.password?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>

        {googleEnabled ? (
          <>
            <div className="relative flex items-center py-1">
              <Separator className="flex-1" />
              <span className="px-3 text-xs text-muted-foreground">หรือ</span>
              <Separator className="flex-1" />
            </div>

            <form action={loginWithGoogleAction}>
              <Button type="submit" variant="outline" className="w-full">
                เข้าสู่ระบบด้วย Google
              </Button>
            </form>
          </>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col gap-2 text-center text-sm text-muted-foreground">
        <div>
          ยังไม่มีบัญชี?{" "}
          <Link
            href="/register"
            className="ml-1 font-medium text-foreground underline underline-offset-4"
          >
            สมัครใช้งาน
          </Link>
        </div>
        <Link
          href="/demo"
          className="text-xs font-medium text-teal-700 underline underline-offset-4 dark:text-teal-400"
        >
          หรือทดลองใช้งานหน้า UI ด้วยข้อมูลตัวอย่าง →
        </Link>
      </CardFooter>
    </Card>
  );
}

export function RegisterForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    INITIAL_STATE
  );

  return (
    <Card className="animate-mf-fade-up w-full max-w-md shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl font-semibold">สร้างบัญชี MoneyFlow</CardTitle>
        <CardDescription>
          ระบบจะสร้างกระเป๋าเงินและหมวดหมู่เริ่มต้นให้โดยอัตโนมัติ
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state.error ? (
          <div
            role="alert"
            className="animate-mf-fade-up rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">ชื่อที่แสดง</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="เช่น ต้นกล้า"
              required
            />
            {state.fieldErrors?.name?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.name[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
            {state.fieldErrors?.email?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.email[0]}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              required
            />
            {state.fieldErrors?.password?.[0] ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "กำลังสร้างบัญชี..." : "สมัครใช้งาน"}
          </Button>
        </form>

        {googleEnabled ? (
          <>
            <div className="relative flex items-center py-1">
              <Separator className="flex-1" />
              <span className="px-3 text-xs text-muted-foreground">หรือ</span>
              <Separator className="flex-1" />
            </div>

            <form action={loginWithGoogleAction}>
              <Button type="submit" variant="outline" className="w-full">
                สมัครด้วย Google
              </Button>
            </form>
          </>
        ) : null}
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        มีบัญชีอยู่แล้ว?{" "}
        <Link
          href="/login"
          className="ml-1 font-medium text-foreground underline underline-offset-4"
        >
          เข้าสู่ระบบ
        </Link>
      </CardFooter>
    </Card>
  );
}
