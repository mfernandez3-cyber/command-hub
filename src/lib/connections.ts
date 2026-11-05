import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentStatus } from "@/lib/types";

/**
 * Cursor and Claude Code only count as connected once their setup is really done:
 * Cursor needs CURSOR_API_KEY, Claude Code needs its GitHub wake-up saved.
 * Anything not connected shows as "Not connected" no matter what the database says.
 */
export async function connectionCheck() {
  let hooked = new Set<string>();
  try {
    const { data } = await createAdminClient().from("agent_webhooks").select("agent_id");
    hooked = new Set((data ?? []).map((r) => r.agent_id as string));
  } catch {}
  const cursorOn = !!process.env.CURSOR_API_KEY;
  return (a: { id: string; adapter?: string; status: AgentStatus; last_seen_at?: string | null }): AgentStatus => {
    if (a.adapter === "cursor" && !cursorOn) return "setup";
    // Claude Code connects either through the Hub connector (it has checked in) or a GitHub wake-up.
    if (a.adapter === "claude_code" && !hooked.has(a.id) && !a.last_seen_at) return "setup";
    if (a.adapter === "manual" && !process.env.ANTHROPIC_API_KEY && !a.last_seen_at) return "setup";
    return a.status;
  };
}
