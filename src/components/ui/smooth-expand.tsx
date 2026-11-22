"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Smoothly expands or collapses container height synchronously in useLayoutEffect
 * using unscaled offsetHeight/scrollHeight and relaxing to height: auto when idle
 * so dialog scale animations or font loading never clip child borders.
 */
export function SmoothExpand({
  children,
  watchKey,
  className,
}: {
  children: ReactNode;
  watchKey: string | number | boolean;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevWatchKeyRef = useRef<string | number | boolean | null>(null);
  const prevHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const nextHeight = inner.scrollHeight;

    if (prevWatchKeyRef.current === null) {
      outer.style.height = "auto";
      prevWatchKeyRef.current = watchKey;
      prevHeightRef.current = nextHeight;
      return;
    }

    if (prevWatchKeyRef.current !== watchKey) {
      const startHeight = prevHeightRef.current ?? outer.offsetHeight;
      if (startHeight !== nextHeight) {
        outer.style.height = `${startHeight}px`;
        // Flush start height before setting target height so CSS transition runs on frame 0.
        void outer.offsetHeight;
        outer.style.height = `${nextHeight}px`;
      } else {
        outer.style.height = "auto";
      }
      prevWatchKeyRef.current = watchKey;
      prevHeightRef.current = nextHeight;
    }
  }, [watchKey]);

  return (
    <div
      ref={outerRef}
      onTransitionEnd={(e) => {
        if (e.target === outerRef.current && e.propertyName === "height") {
          e.currentTarget.style.height = "auto";
          prevHeightRef.current = e.currentTarget.offsetHeight;
        }
      }}
      className={cn(
        "overflow-hidden transition-[height] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        className
      )}
    >
      <div ref={innerRef} className="px-1 py-0.5">
        {children}
      </div>
    </div>
  );
}
