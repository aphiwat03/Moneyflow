"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIsoDateForDisplay } from "@/lib/date";
import type { StreakSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Isolated flame visual slot.
 * Swap `customAssetUrl` later with a Blender 3D export (e.g. `/streak-flame.webm` or `.png`).
 */
export function StreakFlameGraphic({
  active,
  atRisk,
  customAssetUrl,
  size = "md",
}: {
  active: boolean;
  atRisk: boolean;
  customAssetUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const gradId = useId();
  const outerId = `mf-flame-outer-${gradId}`;
  const innerId = `mf-flame-inner-${gradId}`;
  const dimClass =
    size === "lg" ? "h-9 w-9" : size === "sm" ? "h-5 w-5" : "h-7 w-7";

  if (customAssetUrl) {
    const isVideo = /\.(webm|mp4)$/i.test(customAssetUrl);
    if (isVideo) {
      return (
        <video
          src={customAssetUrl}
          autoPlay
          loop
          muted
          playsInline
          className={cn(dimClass, "object-contain")}
        />
      );
    }
    return (
      <Image
        src={customAssetUrl}
        alt="Streak flame"
        width={36}
        height={36}
        unoptimized
        className={cn(dimClass, "object-contain")}
      />
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        dimClass,
        active && "drop-shadow-[0_0_8px_rgba(249,115,22,0.55)]",
        atRisk && "drop-shadow-[0_0_6px_rgba(251,146,60,0.4)]"
      )}
    >
      <svg
        viewBox="0 0 36 36"
        aria-hidden="true"
        className={cn(
          "h-full w-full overflow-visible",
          (active || atRisk) && "animate-mf-flame"
        )}
      >
        <defs>
          <linearGradient id={outerId} x1="0%" y1="100%" x2="100%" y2="0%">
            {active ? (
              <>
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="55%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#facc15" />
              </>
            ) : atRisk ? (
              <>
                <stop offset="0%" stopColor="#c2410c" />
                <stop offset="55%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#fde047" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#94a3b8" />
              </>
            )}
          </linearGradient>
          <linearGradient id={innerId} x1="50%" y1="100%" x2="50%" y2="0%">
            {active ? (
              <>
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#fef08a" />
              </>
            ) : atRisk ? (
              <>
                <stop offset="0%" stopColor="#fdba74" />
                <stop offset="100%" stopColor="#fef9c3" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Outer flame body */}
        <path
          d="M19.8 3.5c.3 3.8-1.4 6.5-3.8 8.7-1.7 1.6-2.9 3.2-2.7 5.3-.9-1-1.3-2.3-1-3.8-3 2.5-4.8 6-4.8 9.8 0 5.9 4.7 10.5 10.6 10.5 6.1 0 10.4-4.5 10.4-10.3 0-4.7-2.6-8.9-5.6-12.5-1.1-1.3-2.2-3.7-3.1-7.7Z"
          fill={`url(#${outerId})`}
          opacity={atRisk ? 0.78 : active ? 1 : 0.75}
        />

        {/* Inner luminous core */}
        <path
          d="M18.3 15.2c1.9 2.2 4.1 4.8 4.1 8.1 0 3.1-2.1 5.4-4.6 5.4-2.6 0-4.6-2.2-4.6-5.2 0-2.5 1.3-4.6 3.2-6.5.7-.7 1.3-1.2 1.9-1.8Z"
          fill={`url(#${innerId})`}
          opacity={atRisk ? 0.8 : active ? 1 : 0.65}
        />
      </svg>
    </span>
  );
}

export function StreakFlameWidget({
  streak,
  customAssetUrl,
  onQuickRecord,
}: {
  streak: StreakSummary;
  customAssetUrl?: string | null;
  onQuickRecord: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isActive = streak.recordedToday && streak.currentStreak > 0;
  const isAtRisk = streak.atRisk;

  return (
    <div
      ref={containerRef}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end lg:right-6 lg:bottom-6"
    >
      {open ? (
        <div
          role="dialog"
          aria-label="รายละเอียดสถิติจดบัญชีต่อเนื่อง"
          className="mb-2.5 w-[min(19rem,calc(100vw-2rem))] animate-mf-fade-up rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/10 sm:w-80"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <StreakFlameGraphic
                active={isActive}
                atRisk={isAtRisk}
                customAssetUrl={customAssetUrl}
                size="lg"
              />
              <div>
                <p className="text-sm font-semibold leading-tight">
                  สถิติจดบัญชีต่อเนื่อง
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {isActive
                    ? "🔥 วันนี้จดเรียบร้อย ไฟติดแล้ว!"
                    : isAtRisk
                      ? "⚠️ จดวันนี้เพื่อรักษาไฟต่อเนื่อง!"
                      : "เริ่มจดรายการวันนี้เพื่อจุดไฟวันแรก"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิดหน้าต่างสถิติไฟ"
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-background p-2.5">
              <p className="text-[11px] text-muted-foreground">ต่อเนื่อง</p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-bold tabular-nums",
                  isActive
                    ? "text-orange-600 dark:text-orange-400"
                    : isAtRisk
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-foreground"
                )}
              >
                {streak.currentStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">วัน</p>
            </div>

            <div className="rounded-xl border bg-background p-2.5">
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <Trophy className="h-3 w-3 text-amber-500" />
                <span>สูงสุด</span>
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {streak.longestStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">วัน</p>
            </div>

            <div className="rounded-xl border bg-background p-2.5">
              <p className="text-[11px] text-muted-foreground">จดแล้ว</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {streak.totalRecordedDays}
              </p>
              <p className="text-[10px] text-muted-foreground">วันรวม</p>
            </div>
          </div>

          {streak.lastRecordedDate ? (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              บันทึกล่าสุด:{" "}
              <span className="font-medium text-foreground">
                {formatIsoDateForDisplay(streak.lastRecordedDate)}
              </span>
            </p>
          ) : null}

          {!streak.recordedToday ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false);
                onQuickRecord();
              }}
              className="mt-3 w-full gap-1.5 bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm hover:from-orange-700 hover:to-amber-600"
            >
              <Plus className="h-4 w-4" />
              <span>จดรายการวันนี้เพื่อต่อไฟ</span>
            </Button>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>ภารกิจจดบัญชีวันนี้สำเร็จแล้ว!</span>
            </div>
          )}

          <p className="mt-2.5 border-t pt-2 text-[10px] text-muted-foreground">
            รองรับเปลี่ยนรูปไฟเป็นโมเดล 3D จาก Blender (.webm / .png) ในอนาคตได้ทันที
          </p>
        </div>
      ) : null}

      {/* Floating TikTok-Style Fire Streak Pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`สถิติจดบัญชีต่อเนื่อง ${streak.currentStreak} วัน`}
        className={cn(
          "group flex items-center gap-2 rounded-full border px-3.5 py-2 shadow-lg backdrop-blur transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]",
          isActive
            ? "border-orange-300 bg-card/95 dark:border-orange-700"
            : isAtRisk
              ? "border-amber-300 bg-card/95 dark:border-amber-700"
              : "border-border bg-card/95"
        )}
      >
        <StreakFlameGraphic
          active={isActive}
          atRisk={isAtRisk}
          customAssetUrl={customAssetUrl}
          size="md"
        />
        <div className="flex flex-col items-start pr-0.5 text-left leading-none">
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "text-base font-extrabold tabular-nums",
                isActive
                  ? "text-orange-600 dark:text-orange-400"
                  : isAtRisk
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
              )}
            >
              {streak.currentStreak}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              วัน
            </span>
          </div>
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium",
              isActive
                ? "text-orange-600 dark:text-orange-400"
                : isAtRisk
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
            )}
          >
            {isActive
              ? "ไฟติดแล้ว"
              : isAtRisk
                ? "รอต่อไฟวันนี้!"
                : "เริ่มจุดไฟ"}
          </span>
        </div>
      </button>
    </div>
  );
}
