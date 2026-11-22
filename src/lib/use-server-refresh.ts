"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

/**
 * Triggers Next.js `router.refresh()` inside a React transition and resolves
 * once the refreshed Server Component payload commits to the UI.
 */
export function useServerRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const resolversRef = useRef<Array<() => void>>([]);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (isPending) {
      wasPendingRef.current = true;
      return;
    }
    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      const resolvers = resolversRef.current.splice(0);
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }, [isPending]);

  useEffect(() => {
    const activeResolvers = resolversRef.current;
    return () => {
      const resolvers = activeResolvers.splice(0);
      for (const resolve of resolvers) {
        resolve();
      }
    };
  }, []);

  const refreshAsync = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        resolve();
      };
      // Safety fallback timeout so a button never hangs indefinitely if payload is unchanged
      const fallbackTimer = setTimeout(done, 4_000);
      resolversRef.current.push(done);
      startTransition(() => {
        router.refresh();
      });
    });
  }, [router]);

  return { refreshAsync, isRefreshing: isPending };
}
