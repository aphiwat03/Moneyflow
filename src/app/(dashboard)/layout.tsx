import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MobileUserMenu, SidebarUserMenu } from "@/components/layout/user-menu";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      userSlot={
        <Suspense
          fallback={<div className="h-9 animate-pulse rounded-md bg-muted" />}
        >
          <SidebarUserMenu />
        </Suspense>
      }
      mobileUserSlot={
        <Suspense
          fallback={<div className="h-7 w-24 animate-pulse rounded-md bg-muted" />}
        >
          <MobileUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
