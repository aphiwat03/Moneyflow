"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  Clock,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIsoDateForDisplay } from "@/lib/date";
import {
  getBangkokCountdownToMidnight,
  getStreakEvolutionInfo,
  STREAK_EVOLUTION_TIERS,
  type StreakEvolutionTier,
} from "@/lib/streak";
import type { StreakSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FlamePalette {
  outer: [string, string, string];
  inner: [string, string];
  glowClass: string;
  sparkColor: string;
}

const LEVEL_PALETTES: Record<StreakEvolutionTier["level"], FlamePalette> = {
  0: {
    outer: ["#64748b", "#94a3b8", "#cbd5e1"],
    inner: ["#94a3b8", "#e2e8f0"],
    glowClass: "",
    sparkColor: "#94a3b8",
  },
  1: {
    outer: ["#ea580c", "#f97316", "#facc15"],
    inner: ["#fb923c", "#fef08a"],
    glowClass: "drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]",
    sparkColor: "#fde047",
  },
  2: {
    outer: ["#c2410c", "#ea580c", "#fbbf24"],
    inner: ["#f59e0b", "#fef9c3"],
    glowClass: "drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]",
    sparkColor: "#fde047",
  },
  3: {
    outer: ["#9333ea", "#ec4899", "#fbbf24"],
    inner: ["#f472b6", "#fef08a"],
    glowClass: "drop-shadow-[0_0_12px_rgba(236,72,153,0.62)]",
    sparkColor: "#f0abfc",
  },
  4: {
    outer: ["#0369a1", "#0ea5e9", "#67e8f9"],
    inner: ["#38bdf8", "#ecfeff"],
    glowClass: "drop-shadow-[0_0_13px_rgba(14,165,233,0.68)]",
    sparkColor: "#a5f3fc",
  },
  5: {
    outer: ["#047857", "#10b981", "#fbbf24"],
    inner: ["#34d399", "#fef08a"],
    glowClass: "drop-shadow-[0_0_14px_rgba(16,185,129,0.68)]",
    sparkColor: "#fde047",
  },
  6: {
    outer: ["#7c3aed", "#ec4899", "#22d3ee"],
    inner: ["#f472b6", "#fef9c3"],
    glowClass: "drop-shadow-[0_0_15px_rgba(168,85,247,0.75)]",
    sparkColor: "#fef08a",
  },
};

/**
 * Isolated 7-level flame visual slot (Lv.0–Lv.6).
 * Supports per-level Blender 3D assets (`assetUrlsByLevel`) or single `customAssetUrl` override.
 */
export function StreakFlameGraphic({
  active,
  atRisk,
  level = 1,
  customAssetUrl,
  assetUrlsByLevel,
  size = "md",
}: {
  active: boolean;
  atRisk: boolean;
  level?: StreakEvolutionTier["level"];
  customAssetUrl?: string | null;
  assetUrlsByLevel?: Partial<Record<StreakEvolutionTier["level"], string>>;
  size?: "sm" | "md" | "lg";
}) {
  const gradId = useId();
  const outerId = `mf-flame-outer-${gradId}`;
  const innerId = `mf-flame-inner-${gradId}`;
  const dimClass =
    size === "lg" ? "h-10 w-10" : size === "sm" ? "h-5 w-5" : "h-7 w-7";

  const effectiveAsset = assetUrlsByLevel?.[level] ?? customAssetUrl ?? null;

  if (effectiveAsset) {
    const isVideo = /\.(webm|mp4)$/i.test(effectiveAsset);
    if (isVideo) {
      return (
        <video
          src={effectiveAsset}
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
        src={effectiveAsset}
        alt={`Streak flame Lv.${level}`}
        width={40}
        height={40}
        unoptimized
        className={cn(dimClass, "object-contain")}
      />
    );
  }

  const effectiveLevel: StreakEvolutionTier["level"] =
    !active && !atRisk && level === 0 ? 0 : level;
  const palette = LEVEL_PALETTES[effectiveLevel];
  const isLit = effectiveLevel > 0 && (active || atRisk);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        dimClass,
        isLit && !atRisk && palette.glowClass,
        atRisk && "opacity-80 drop-shadow-[0_0_6px_rgba(251,146,60,0.4)]"
      )}
    >
      <svg
        viewBox="0 0 36 36"
        aria-hidden="true"
        className={cn(
          "h-full w-full overflow-visible",
          isLit && "animate-mf-flame"
        )}
      >
        <defs>
          <linearGradient id={outerId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.outer[0]} />
            <stop offset="55%" stopColor={palette.outer[1]} />
            <stop offset="100%" stopColor={palette.outer[2]} />
          </linearGradient>
          <linearGradient id={innerId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor={palette.inner[0]} />
            <stop offset="100%" stopColor={palette.inner[1]} />
          </linearGradient>
        </defs>

        {/* Lv.6 rotating prism aura ring */}
        {effectiveLevel === 6 ? (
          <circle
            cx="18"
            cy="20"
            r="14"
            fill="none"
            stroke={`url(#${outerId})`}
            strokeWidth="1.4"
            strokeDasharray="4 3"
            className="animate-mf-aura"
            opacity={0.75}
          />
        ) : null}

        {/* Lv.5 golden halo ring */}
        {effectiveLevel === 5 ? (
          <ellipse
            cx="18"
            cy="31.5"
            rx="10"
            ry="2.3"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.4"
            opacity={0.85}
          />
        ) : null}

        {/* Outer flame body: sharper twin-horn at Lv.3+, plasma tip at Lv.4+ */}
        {effectiveLevel >= 3 ? (
          <path
            d="M18.6 2.5c1.6 3.9 5.5 6.3 6.3 10.6.4-1.3.4-2.5.1-3.8 2.8 2.8 4.1 6.2 4.1 10.1 0 6.5-4.7 11.6-11.1 11.6S6.9 26 6.9 19.6c0-4.2 2-8.2 5.4-11-.3 1.7.1 3.3 1.2 4.5-.3-2.5.9-4.7 2.8-6.6 1.3-1.3 2.1-2.5 2.3-4Z"
            fill={`url(#${outerId})`}
            opacity={atRisk ? 0.8 : 1}
          />
        ) : (
          <path
            d="M19.8 3.5c.3 3.8-1.4 6.5-3.8 8.7-1.7 1.6-2.9 3.2-2.7 5.3-.9-1-1.3-2.3-1-3.8-3 2.5-4.8 6-4.8 9.8 0 5.9 4.7 10.5 10.6 10.5 6.1 0 10.4-4.5 10.4-10.3 0-4.7-2.6-8.9-5.6-12.5-1.1-1.3-2.2-3.7-3.1-7.7Z"
            fill={`url(#${outerId})`}
            opacity={atRisk ? 0.78 : effectiveLevel === 0 ? 0.72 : 1}
          />
        )}

        {/* Inner luminous core */}
        <path
          d="M18.3 14.8c2 2.2 4.3 4.8 4.3 8.2 0 3.2-2.1 5.6-4.6 5.6-2.6 0-4.7-2.3-4.7-5.4 0-2.6 1.4-4.8 3.2-6.6.7-.7 1.2-1.2 1.8-1.8Z"
          fill={`url(#${innerId})`}
          opacity={atRisk ? 0.82 : effectiveLevel === 0 ? 0.65 : 1}
        />

        {/* Lv.5 mini emerald crown */}
        {effectiveLevel === 5 ? (
          <path
            d="M13 6.2l1.8-2.8 3.2 2 3.2-2 1.8 2.8-1.1 1.6h-7.8L13 6.2Z"
            fill="#fbbf24"
          />
        ) : null}

        {/* Rising sparks for Lv.2+ */}
        {effectiveLevel >= 2 ? (
          <>
            <circle
              cx="8.5"
              cy="10"
              r="1.3"
              fill={palette.sparkColor}
              className="animate-mf-spark"
            />
            <circle
              cx="27.5"
              cy="11.5"
              r="1.1"
              fill={palette.sparkColor}
              className="animate-mf-spark"
            />
          </>
        ) : null}

        {/* Extra star glint for Lv.4 & Lv.6 */}
        {effectiveLevel === 4 || effectiveLevel === 6 ? (
          <path
            d="M29 6.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5Z"
            fill={palette.sparkColor}
            className="animate-mf-spark"
          />
        ) : null}
      </svg>
    </span>
  );
}

const PREVIEW_DAY_STEPS = [0, 1, 3, 10, 30, 100, 200] as const;

export function StreakFlameWidget({
  streak,
  customAssetUrl,
  assetUrlsByLevel,
  onQuickRecord,
}: {
  streak: StreakSummary;
  customAssetUrl?: string | null;
  assetUrlsByLevel?: Partial<Record<StreakEvolutionTier["level"], string>>;
  onQuickRecord: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [previewDays, setPreviewDays] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState(() =>
    getBangkokCountdownToMidnight().label
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const refreshCountdown = () => {
      setCountdownLabel(getBangkokCountdownToMidnight().label);
    };
    refreshCountdown();
    const timer = setInterval(refreshCountdown, 60_000);

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
      clearInterval(timer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const effectiveStreak: StreakSummary =
    previewDays === null
      ? streak
      : {
          currentStreak: previewDays,
          longestStreak: Math.max(streak.longestStreak, previewDays),
          totalRecordedDays: Math.max(streak.totalRecordedDays, previewDays),
          recordedToday: previewDays > 0,
          atRisk: false,
          lastRecordedDate: streak.lastRecordedDate,
        };

  const evolution = getStreakEvolutionInfo(effectiveStreak);
  const isActive =
    effectiveStreak.recordedToday && effectiveStreak.currentStreak > 0;
  const isAtRisk = effectiveStreak.atRisk;

  return (
    <div
      ref={containerRef}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end lg:right-6 lg:bottom-6"
    >
      {open ? (
        <div
          role="dialog"
          aria-label="รายละเอียดสถิติจดบัญชีต่อเนื่อง"
          className="mb-2.5 max-h-[75dvh] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto animate-mf-fade-up rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/10 sm:w-88"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <StreakFlameGraphic
                active={isActive}
                atRisk={isAtRisk}
                level={evolution.currentTier.level}
                customAssetUrl={customAssetUrl}
                assetUrlsByLevel={assetUrlsByLevel}
                size="lg"
              />
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                      evolution.currentTier.accentTextClass
                    )}
                  >
                    {evolution.currentTier.badgeText}
                  </span>
                  <p className="text-sm font-semibold leading-tight">
                    {evolution.currentTier.title}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {evolution.currentTier.subtitle}
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

          {evolution.justEvolvedToday ? (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-fuchsia-300/60 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-700 dark:border-fuchsia-700 dark:text-fuchsia-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>อัปเกรดร่างใหม่แล้ว! ({evolution.currentTier.title})</span>
            </div>
          ) : null}

          {isAtRisk ? (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>เหลืออีก {countdownLabel} ก่อนไฟดับ!</span>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-background p-2">
              <p className="text-[11px] text-muted-foreground">ต่อเนื่อง</p>
              <p
                className={cn(
                  "mt-0.5 text-lg font-bold tabular-nums",
                  isActive || isAtRisk
                    ? evolution.currentTier.accentTextClass
                    : "text-foreground"
                )}
              >
                {effectiveStreak.currentStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">วัน</p>
            </div>

            <div className="rounded-xl border bg-background p-2">
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <Trophy className="h-3 w-3 text-amber-500" />
                <span>สูงสุด</span>
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {effectiveStreak.longestStreak}
              </p>
              <p className="text-[10px] text-muted-foreground">วัน</p>
            </div>

            <div className="rounded-xl border bg-background p-2">
              <p className="text-[11px] text-muted-foreground">จดแล้ว</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {effectiveStreak.totalRecordedDays}
              </p>
              <p className="text-[10px] text-muted-foreground">วันรวม</p>
            </div>
          </div>

          {/* Progress to next tier */}
          <div className="mt-3 rounded-xl border bg-background/70 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">
                {evolution.nextTier
                  ? `อีก ${evolution.daysToNextTier} วัน → ${evolution.nextTier.badgeText} ${evolution.nextTier.title}`
                  : "ปลดล็อกครบทุกร่างแล้ว!"}
              </span>
              <span className="font-semibold tabular-nums">
                {evolution.progressToNextPct}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-emerald-500 transition-[width] duration-300"
                style={{ width: `${evolution.progressToNextPct}%` }}
              />
            </div>
          </div>

          {/* 6 Evolution Tiers Gallery (Lv.1 - Lv.6) */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">
                ร่างวิวัฒนาการทั้งหมด (คลิกเพื่อดูตัวอย่าง)
              </span>
              {previewDays !== null ? (
                <button
                  type="button"
                  onClick={() => setPreviewDays(null)}
                  className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline dark:text-teal-300"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>กลับค่าจริง</span>
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {STREAK_EVOLUTION_TIERS.filter((t) => t.level > 0).map((tier) => {
                const unlocked = tier.level <= evolution.unlockedMaxLevel;
                const selected = tier.level === evolution.currentTier.level;
                return (
                  <button
                    key={tier.level}
                    type="button"
                    onClick={() => setPreviewDays(tier.minDays)}
                    className={cn(
                      "relative flex flex-col items-center rounded-xl border p-1.5 text-center transition-colors",
                      selected
                        ? "border-teal-600/60 bg-teal-600/10"
                        : "bg-background hover:bg-muted/60",
                      !unlocked && "opacity-55"
                    )}
                    title={`${tier.badgeText} ${tier.title} (${tier.minDays}+ วัน)`}
                  >
                    {!unlocked ? (
                      <Lock
                        aria-hidden="true"
                        className="absolute top-1 right-1 h-2.5 w-2.5 text-muted-foreground"
                      />
                    ) : null}
                    <StreakFlameGraphic
                      active
                      atRisk={false}
                      level={tier.level}
                      customAssetUrl={customAssetUrl}
                      assetUrlsByLevel={assetUrlsByLevel}
                      size="sm"
                    />
                    <span className="mt-1 text-[10px] font-semibold">
                      {tier.minDays}+ วัน
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview Stepper */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-muted-foreground">เทสวัน:</span>
            {PREVIEW_DAY_STEPS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setPreviewDays(days)}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums transition-colors",
                  previewDays === days
                    ? "border-teal-600 bg-teal-600/15 font-semibold text-teal-700 dark:text-teal-300"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {days}
              </button>
            ))}
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
              className="mt-2.5 w-full gap-1.5 bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm hover:from-orange-700 hover:to-amber-600"
            >
              <Plus className="h-4 w-4" />
              <span>จดรายการวันนี้เพื่อต่อไฟ</span>
            </Button>
          ) : (
            <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>ภารกิจจดบัญชีวันนี้สำเร็จแล้ว!</span>
            </div>
          )}

          <p className="mt-2.5 border-t pt-2 text-[10px] text-muted-foreground">
            รองรับเปลี่ยนรูปไฟเป็นโมเดล 3D จาก Blender (.webm / .png) แยกตามขั้น Lv.1–Lv.6 ได้ทันที
          </p>
        </div>
      ) : null}

      {/* Floating TikTok-Style Fire Streak Pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`สถิติจดบัญชีต่อเนื่อง ${effectiveStreak.currentStreak} วัน (${evolution.currentTier.title})`}
        className={cn(
          "group flex items-center gap-2 rounded-full border bg-card/95 px-3.5 py-2 shadow-lg backdrop-blur transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]",
          isActive
            ? evolution.currentTier.pillBorderClass
            : isAtRisk
              ? "border-amber-300 dark:border-amber-700"
              : "border-border"
        )}
      >
        <StreakFlameGraphic
          active={isActive}
          atRisk={isAtRisk}
          level={evolution.currentTier.level}
          customAssetUrl={customAssetUrl}
          assetUrlsByLevel={assetUrlsByLevel}
          size="md"
        />
        <div className="flex flex-col items-start pr-0.5 text-left leading-none">
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "text-base font-extrabold tabular-nums",
                isActive
                  ? evolution.currentTier.accentTextClass
                  : isAtRisk
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
              )}
            >
              {effectiveStreak.currentStreak}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              วัน
            </span>
          </div>
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium",
              isActive
                ? evolution.currentTier.accentTextClass
                : isAtRisk
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
            )}
          >
            {previewDays !== null
              ? `${evolution.currentTier.badgeText} ตัวอย่าง`
              : isActive
                ? evolution.currentTier.title
                : isAtRisk
                  ? "รอต่อไฟวันนี้!"
                  : "เริ่มจุดไฟ"}
          </span>
        </div>
      </button>
    </div>
  );
}
