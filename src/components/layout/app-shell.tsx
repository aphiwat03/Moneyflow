"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  PiggyBank,
  Plus,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/transactions", label: "รายการ", icon: ArrowLeftRight },
  { href: "/plan", label: "แผนเงินเดือน", icon: PiggyBank },
  { href: "/investments", label: "การลงทุน", icon: TrendingUp },
  { href: "/manage", label: "กระเป๋า & หมวดหมู่", icon: WalletCards },
] as const;

const FOCUS_REFRESH_THROTTLE_MS = 45_000;

export function AppShell({
  children,
  userSlot,
  mobileUserSlot,
}: {
  children: ReactNode;
  userSlot: ReactNode;
  mobileUserSlot: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const lastRefreshRef = useRef<number>(0);

  // Sync latest data across Mobile & PC when the user returns to the window/tab
  useEffect(() => {
    lastRefreshRef.current = Date.now();

    function handleRevalidateOnFocus() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRefreshRef.current < FOCUS_REFRESH_THROTTLE_MS) return;
      lastRefreshRef.current = now;
      router.refresh();
    }

    window.addEventListener("focus", handleRevalidateOnFocus);
    document.addEventListener("visibilitychange", handleRevalidateOnFocus);
    return () => {
      window.removeEventListener("focus", handleRevalidateOnFocus);
      document.removeEventListener("visibilitychange", handleRevalidateOnFocus);
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh w-full bg-muted/20">
      {/* Desktop / iPad Landscape Sidebar */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-none">MoneyFlow</p>
            <p className="mt-1 text-xs text-muted-foreground">บันทึกรายรับ-รายจ่าย</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="เมนูหลัก">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">{userSlot}</div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile & iPad Portrait Header */}
        <header className="sticky top-0 z-30 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="font-semibold">MoneyFlow</span>
            </Link>
            {mobileUserSlot}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile & iPad Portrait Bottom Navigation */}
      <nav
        aria-label="เมนูมือถือ"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pr-[max(0.25rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] pl-[max(0.25rem,env(safe-area-inset-left))] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-6 items-center">
          <Link
            href="/"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              pathname === "/"
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>ภาพรวม</span>
          </Link>

          <Link
            href="/transactions"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              pathname.startsWith("/transactions")
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <ArrowLeftRight className="h-5 w-5" />
            <span>รายการ</span>
          </Link>

          <Link
            href="/transactions?add=1"
            aria-label="บันทึกรายการใหม่"
            className="flex flex-col items-center justify-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-white shadow-md sm:h-11 sm:w-11">
              <Plus className="h-5 w-5" />
            </span>
          </Link>

          <Link
            href="/plan"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              pathname.startsWith("/plan")
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <PiggyBank className="h-5 w-5" />
            <span>แผนเงิน</span>
          </Link>

          <Link
            href="/investments"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              pathname.startsWith("/investments")
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <span>ลงทุน</span>
          </Link>

          <Link
            href="/manage"
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              pathname.startsWith("/manage")
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <WalletCards className="h-5 w-5" />
            <span>จัดการ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
