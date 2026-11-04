import "server-only";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type DoorAgent = { id: string; name: string; can_route: boolean; visibility: "team" | "owner" };

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function newKey() {
  const key = "hub_" + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), hint: key.slice(0, 8) + "..." + key.slice(-4) };
}

/** Finds the agent that owns this key, or null. Also records that the agent checked in. */
export async function agentForKey(key: string | null | undefined): Promise<DoorAgent | null> {
  if (!key || !key.startsWith("hub_")) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("agent_keys")
    .select("agent_id, agents(id, name, can_route, visibility)")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  const agent = (data?.agents as unknown as DoorAgent | null) ?? null;
  if (!agent) return null;
  const now = new Date().toISOString();
  await Promise.all([
    db.from("agent_keys").update({ last_used_at: now }).eq("agent_id", agent.id),
    db.from("agents").update({ last_seen_at: now }).eq("id", agent.id),
    // First check-in means the agent is connected.
    db.from("agents").update({ status: "idle" }).eq("id", agent.id).eq("status", "setup"),
  ]);
  return agent;
}

/** Pulls the key from the Authorization header, an x-hub-key header, a ?key= link, or a form field. */
export function keyFromRequest(req: Request, form?: Record<string, unknown>) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-hub-key");
  if (header) return header.trim();
  const fromUrl = new URL(req.url).searchParams.get("key");
  if (fromUrl) return fromUrl;
  if (form && typeof form.key === "string") return form.key;
  return null;
}

export const OPEN_STATUSES = ["queued", "running", "needs_you"] as const;

/**
 * Tasks this agent may see: its own, plus (for a router like Tara) every task
 * on a team-visible agent or unassigned. Owner-only agents' work stays private.
 */
export async function visibleTaskIds(agent: DoorAgent, statuses: readonly string[]) {
  const db = createAdminClient();
  let q = db
    .from("tasks")
    .select("id, title, instruction, status, priority, created_at, updated_at, result_summary, agent_id, agents(name, visibility)")
    .in("status", statuses as string[])
    .order("priority")
    .order("created_at")
    .limit(50);
  if (!agent.can_route) q = q.eq("agent_id", agent.id);
  const { data } = await q;
  type Row = NonNullable<typeof data>[number] & { agents: { name: string; visibility: string } | null };
  return ((data ?? []) as Row[]).filter(
    (t) => t.agent_id === agent.id || !t.agents || t.agents.visibility === "team",
  );
}

export async function canTouchTask(agent: DoorAgent, taskId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("tasks")
    .select("id, agent_id, status, title, agents(visibility)")
    .eq("id", taskId)
    .maybeSingle();
  if (!data) return null;
  const vis = (data.agents as unknown as { visibility: string } | null)?.visibility;
  if (data.agent_id === agent.id) return data;
  if (agent.can_route && (!data.agent_id || vis === "team")) return data;
  return null;
}
