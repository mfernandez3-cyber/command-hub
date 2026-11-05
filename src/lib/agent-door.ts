import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type DoorAgent = {
  id: string;
  name: string;
  can_route: boolean;
  visibility: "team" | "owner";
  /** Set when the caller used a task pass: it may only touch this one task. */
  onlyTask?: string;
};

/*
  Task passes. Agents that start fresh each time (Claude routines) get a short-lived pass with
  every wake-up instead of a stored key. A pass works for one agent, one task, for 24 hours.
*/
function passSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.HUB_PASS_SECRET ?? "";
}

export function makeTaskPass(agentId: string, taskId: string, hours = 24) {
  const exp = Math.floor(Date.now() / 1000) + hours * 3600;
  const body = `${agentId}.${taskId}.${exp}`;
  const sig = createHmac("sha256", passSecret()).update("pass:" + body).digest("base64url");
  return `hubpass_${Buffer.from(body).toString("base64url")}.${sig}`;
}

function readTaskPass(pass: string): { agentId: string; taskId: string } | null {
  const [b64, sig] = pass.slice("hubpass_".length).split(".");
  if (!b64 || !sig) return null;
  const body = Buffer.from(b64, "base64url").toString();
  const want = createHmac("sha256", passSecret()).update("pass:" + body).digest("base64url");
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const [agentId, taskId, exp] = body.split(".");
  if (!agentId || !taskId || Number(exp) < Date.now() / 1000) return null;
  return { agentId, taskId };
}

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function newKey() {
  const key = "hub_" + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), hint: key.slice(0, 8) + "..." + key.slice(-4) };
}

/** Finds the agent that owns this key, or null. Also records that the agent checked in. */
export async function agentForKey(key: string | null | undefined): Promise<DoorAgent | null> {
  if (key?.startsWith("hubpass_")) {
    const pass = readTaskPass(key);
    if (!pass) return null;
    const db = createAdminClient();
    const { data } = await db.from("agents").select("id, name, can_route, visibility").eq("id", pass.agentId).maybeSingle();
    if (!data) return null;
    const now = new Date().toISOString();
    await Promise.all([
      db.from("agents").update({ last_seen_at: now }).eq("id", data.id),
      db.from("agents").update({ status: "idle" }).eq("id", data.id).eq("status", "setup"),
    ]);
    // A pass never carries chief-of-staff powers, and only reaches its own task.
    return { ...(data as DoorAgent), can_route: false, onlyTask: pass.taskId };
  }
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
export type DoorTask = {
  id: string;
  title: string;
  instruction: string;
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
  result_summary: string | null;
  agent_id: string | null;
  agents: { name: string; visibility: string } | null;
};

export async function visibleTaskIds(agent: DoorAgent, statuses: readonly string[]): Promise<DoorTask[]> {
  const db = createAdminClient();
  if (agent.onlyTask) {
    const { data } = await db
      .from("tasks")
      .select("id, title, instruction, status, priority, created_at, updated_at, result_summary, agent_id, agents(name, visibility)")
      .eq("id", agent.onlyTask)
      .eq("agent_id", agent.id);
    return (data ?? []) as unknown as DoorTask[];
  }
  let q = db
    .from("tasks")
    .select("id, title, instruction, status, priority, created_at, updated_at, result_summary, agent_id, agents(name, visibility)")
    .in("status", statuses as string[])
    .order("priority")
    .order("created_at")
    .limit(50);
  if (!agent.can_route) q = q.eq("agent_id", agent.id);
  const { data } = await q;
  return ((data ?? []) as unknown as DoorTask[]).filter(
    (t) => t.agent_id === agent.id || !t.agents || t.agents.visibility === "team",
  );
}

export async function canTouchTask(agent: DoorAgent, taskId: string) {
  if (agent.onlyTask && agent.onlyTask !== taskId) return null;
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
