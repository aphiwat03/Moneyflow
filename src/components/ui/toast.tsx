"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
}

type Listener = (items: ToastItem[]) => void;

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 4500;

let toastQueue: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) {
    listener(toastQueue);
  }
}

export function dismissToast(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toastQueue = toastQueue.filter((item) => item.id !== id);
  emit();
}

function pushToast(kind: ToastKind, title: string, detail?: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toastQueue = [...toastQueue.slice(-(MAX_TOASTS - 1)), { id, kind, title, detail }];
  emit();

  const timer = setTimeout(() => {
    dismissToast(id);
  }, TOAST_DURATION_MS);
  timers.set(id, timer);
}

export const toast = {
  success: (title: string, detail?: string) =>
    pushToast("success", title, detail),
  warning: (title: string, detail?: string) =>
    pushToast("warning", title, detail),
  error: (title: string, detail?: string) =>
    pushToast("error", title, detail),
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[100] flex flex-col gap-2 sm:inset-x-auto sm:top-4 sm:right-4 sm:w-96"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-background/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md animate-mf-fade-up",
            item.kind === "success" &&
              "border-emerald-600/35 text-emerald-900 dark:text-emerald-100",
            item.kind === "warning" &&
              "border-amber-500/45 text-amber-950 dark:text-amber-100",
            item.kind === "error" &&
              "border-destructive/45 text-destructive"
          )}
        >
          {item.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                item.kind === "warning"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive"
              )}
            />
          )}

          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold">{item.title}</p>
            {item.detail ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label="ปิดการแจ้งเตือน"
            className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
