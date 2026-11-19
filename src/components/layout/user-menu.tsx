import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/session";

export async function SidebarUserMenu() {
  const user = await getOptionalUser();
  if (!user) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name ?? "ผู้ใช้งาน"}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          title="ออกจากระบบ"
          aria-label="ออกจากระบบ"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export async function MobileUserMenu() {
  const user = await getOptionalUser();
  if (!user) return null;

  return (
    <form action={logoutAction} className="flex items-center gap-2">
      <span className="max-w-32 truncate text-xs text-muted-foreground">
        {user.name ?? user.email}
      </span>
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        className="max-lg:size-9"
        title="ออกจากระบบ"
        aria-label="ออกจากระบบ"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  );
}
