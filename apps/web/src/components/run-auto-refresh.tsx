"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the server component while a run is in progress. This is the M2
 * stopgap; Milestone 5 replaces it with a live WebSocket trace stream.
 */
export function RunAutoRefresh({ intervalMs = 2500 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
