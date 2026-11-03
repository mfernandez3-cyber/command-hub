"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the current page whenever tasks, events or approvals change,
 * so the board and threads stay live without a manual refresh.
 */
export function LiveRefresh({ taskId }: { taskId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase
      .channel(taskId ? `task-${taskId}` : "hub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", ...(taskId ? { filter: `task_id=eq.${taskId}` } : {}) },
        refresh,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, taskId]);
  return null;
}
