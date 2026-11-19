"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Smoothly expands or collapses container height synchronously in useLayoutEffect
 * so transitions start on frame 0 without ResizeObserver/rAF lag.
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
  const prevHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const nextHeight = inner.getBoundingClientRect().height;

    if (prevHeightRef.current === null) {
      outer.style.height = `${nextHeight}px`;
      prevHeightRef.current = nextHeight;
      return;
    }

    if (prevHeightRef.current !== nextHeight) {
      outer.style.height = `${prevHeightRef.current}px`;
      // Flush start height before setting target height so CSS transition runs on frame 0.
      void outer.offsetHeight;
      outer.style.height = `${nextHeight}px`;
      prevHeightRef.current = nextHeight;
    }
  }, [watchKey]);

  useEffect(() => {
    const syncOnResize = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const nextHeight = inner.getBoundingClientRect().height;
      outer.style.height = `${nextHeight}px`;
      prevHeightRef.current = nextHeight;
    };

    window.addEventListener("resize", syncOnResize);
    return () => window.removeEventListener("resize", syncOnResize);
  }, []);

  return (
    <div
      ref={outerRef}
      className={cn(
        "overflow-hidden transition-[height] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        className
      )}
    >
      <div ref={innerRef} className="px-1">
        {children}
      </div>
    </div>
  );
}
