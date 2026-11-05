import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { OPEN_STATUSES, canTouchTask, visibleTaskIds, type DoorAgent } from "@/lib/agent-door";
import { wakeAgent } from "@/lib/wake";

export class DoorError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const EVENT_TYPES = ["message", "step", "output", "error"] as const;
const APPROVAL_TYPES = ["spend", "post", "send", "merge", "delete"] as const;

function text(v: unknown, field: string, max = 4000) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new DoorError(400, `Missing ${field}`);
  return s.slice(0, max);
}

async function touchAgentStatus(agentId: string | null) {
  if (!agentId) return;
  const db = createAdminClient();
  const { count: needs } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "needs_you");
  const { count: running } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "running");
  const status = (needs ?? 0) > 0 ? "needs_you" : (running ?? 0) > 0 ? "working" : "idle";
  await db.from("agents").update({ status }).eq("id", agentId).neq("status", "paused");
}

async function requireTask(agent: DoorAgent, taskId: string) {
  const task = await canTouchTask(agent, taskId);
  if (!task) throw new DoorError(404, "Task not found, or it isn't yours");
  return task;
}

/** Everything open this agent should look at, with recent thread messages and approval decisions. */
export async function listTasks(agent: DoorAgent) {
  const db = createAdminClient();
  const tasks = await visibleTaskIds(agent, OPEN_STATUSES);
  const ids = tasks.map((t) => t.id);
  const [{ data: events }, { data: approvals }] = await Promise.all([
    ids.length
      ? db.from("events").select("task_id, author, type, body, link, created_at").in("task_id", ids).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? db.from("approvals").select("id, task_id, action_type, summary, status, decided_at").in("task_id", ids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    instruction: t.instruction,
    status: t.status,
    priority: t.priority,
    assigned_to: t.agents?.name ?? null,
    yours: t.agent_id === agent.id,
    created_at: t.created_at,
    recent_messages: (events ?? [])
      .filter((e) => e.task_id === t.id)
      .slice(0, 8)
      .reverse(),
    approvals: (approvals ?? []).filter((a) => a.task_id === t.id),
  }));
}

export async function claimTask(agent: DoorAgent, taskId: string) {
  const task = await requireTask(agent, taskId);
  const db = createAdminClient();
  const updates: Record<string, unknown> = { status: "running" };
  if (!task.agent_id) updates.agent_id = agent.id;
  await db.from("tasks").update(updates).eq("id", taskId);
  await db.from("events").insert({ task_id: taskId, author: agent.name, type: "status", body: "Started working on this." });
  await touchAgentStatus(agent.id);
  return { ok: true };
}

export async function postNote(agent: DoorAgent, taskId: string, input: Record<string, unknown>) {
  await requireTask(agent, taskId);
  const type = (EVENT_TYPES as readonly string[]).includes(String(input.type)) ? String(input.type) : "message";
  const link = typeof input.link === "string" && /^https?:\/\//.test(input.link) ? input.link : null;
  const db = createAdminClient();
  await db.from("events").insert({ task_id: taskId, author: agent.name, type, body: text(input.body, "body"), link });
  return { ok: true };
}

export async function completeTask(agent: DoorAgent, taskId: string, input: Record<string, unknown>) {
  const task = await requireTask(agent, taskId);
  const status = input.status === "failed" ? "failed" : "done";
  const summary = text(input.summary, "summary", 2000);
  const db = createAdminClient();
  const { count: pending } = await db
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId)
    .eq("status", "pending");
  if ((pending ?? 0) > 0) throw new DoorError(409, "This task has an approval still waiting on Manny. It can't be closed yet.");
  await db.from("tasks").update({ status, result_summary: summary }).eq("id", taskId);
  await db.from("events").insert({
    task_id: taskId,
    author: agent.name,
    type: status === "done" ? "output" : "error",
    body: (status === "done" ? "Done: " : "Could not finish: ") + summary,
  });
  await touchAgentStatus(task.agent_id);
  return { ok: true };
}

export async function assignTask(agent: DoorAgent, taskId: string, input: Record<string, unknown>) {
  if (!agent.can_route) throw new DoorError(403, "Only the chief of staff can hand tasks to other agents");
  const task = await requireTask(agent, taskId);
  const to = text(input.to, "to", 80);
  const db = createAdminClient();
  const { data: target } = await db.from("agents").select("id, name, visibility").ilike("name", to).maybeSingle();
  if (!target) throw new DoorError(404, `No agent named ${to}`);
  if (target.visibility !== "team") throw new DoorError(403, `${target.name} is private to Manny`);
  await db.from("tasks").update({ agent_id: target.id, status: "queued" }).eq("id", taskId);
  const note = typeof input.note === "string" && input.note.trim() ? ` Note: ${input.note.trim().slice(0, 1000)}` : "";
  await db.from("events").insert({ task_id: taskId, author: agent.name, type: "status", body: `Handed to ${target.name}.${note}` });
  await Promise.all([touchAgentStatus(task.agent_id), touchAgentStatus(target.id)]);
  if (target.id !== agent.id) after(() => wakeAgent(target.id, "handed_to_you", taskId, input.note ? String(input.note) : undefined));
  return { ok: true, assigned_to: target.name };
}

export async function askApproval(agent: DoorAgent, taskId: string, input: Record<string, unknown>) {
  const task = await requireTask(agent, taskId);
  const action = String(input.action_type ?? "");
  if (!(APPROVAL_TYPES as readonly string[]).includes(action))
    throw new DoorError(400, `action_type must be one of: ${APPROVAL_TYPES.join(", ")}`);
  const summary = text(input.summary, "summary", 300);
  const amount = input.amount_usd !== undefined && input.amount_usd !== "" ? Number(input.amount_usd) : null;
  const details = typeof input.details === "string" ? { text: input.details.slice(0, 4000) } : {};
  const db = createAdminClient();
  const { data } = await db
    .from("approvals")
    .insert({
      task_id: taskId,
      action_type: action,
      summary,
      details,
      amount_usd: Number.isFinite(amount) ? amount : null,
      requested_by: agent.name,
    })
    .select("id")
    .single();
  await db.from("tasks").update({ status: "needs_you" }).eq("id", taskId);
  await db.from("events").insert({ task_id: taskId, author: agent.name, type: "status", body: `Asked for approval: ${summary}` });
  await touchAgentStatus(task.agent_id);
  return { ok: true, approval_id: data?.id };
}

export async function newTask(agent: DoorAgent, input: Record<string, unknown>) {
  if (agent.onlyTask) throw new DoorError(403, "A task pass can't create new tasks. Post an update on your task instead.");
  const instruction = text(input.instruction, "instruction");
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : instruction.slice(0, 80);
  const db = createAdminClient();
  let agentId = agent.id;
  let agentName = agent.name;
  if (typeof input.assign_to === "string" && input.assign_to.trim()) {
    if (!agent.can_route) throw new DoorError(403, "Only the chief of staff can create tasks for other agents");
    const { data: target } = await db.from("agents").select("id, name, visibility").ilike("name", input.assign_to.trim()).maybeSingle();
    if (!target || target.visibility !== "team") throw new DoorError(404, `No team agent named ${input.assign_to}`);
    agentId = target.id;
    agentName = target.name;
  }
  const priority = [1, 2, 3].includes(Number(input.priority)) ? Number(input.priority) : 2;
  const { data, error } = await db
    .from("tasks")
    .insert({ title, instruction, agent_id: agentId, priority, project: typeof input.project === "string" ? input.project : null })
    .select("id")
    .single();
  if (error || !data) throw new DoorError(500, "Could not create the task");
  await db.from("events").insert([
    { task_id: data.id, author: agent.name, type: "message", body: instruction },
    { task_id: data.id, author: "system", type: "status", body: `Assigned to ${agentName}.` },
  ]);
  if (agentId !== agent.id) after(() => wakeAgent(agentId, "new_task", data.id));
  return { ok: true, task_id: data.id, assigned_to: agentName };
}

export async function readMemory(agent: DoorAgent, q: string | null) {
  const db = createAdminClient();
  let query = db
    .from("memory")
    .select("title, body, tags, updated_at, agent_id, agents(visibility)")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ").slice(0, 80);
    query = query.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
  }
  const { data } = await query;
  return (data ?? [])
    .filter((m) => {
      const vis = (m.agents as unknown as { visibility: string } | null)?.visibility;
      return !m.agent_id || m.agent_id === agent.id || vis === "team";
    })
    .map(({ title, body, tags, updated_at }) => ({ title, body, tags, updated_at }));
}

/** An agent registers its own wake webhook (for example its Grok Bot routine). A test wake is sent right away. */
export async function registerWakeHook(agent: DoorAgent, input: Record<string, unknown>) {
  if (agent.onlyTask) throw new DoorError(403, "A task pass can't change the wake-up.");
  const url = text(input.url, "url", 500);
  let secret = typeof (input.key ?? input.secret) === "string" ? String(input.key ?? input.secret).trim().slice(0, 500) : "";
  if (secret.toLowerCase().startsWith("bearer ")) secret = secret.slice(7).trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DoorError(400, "url must be a full https web address");
  }
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname))
    throw new DoorError(400, "url must start with https://");
  const db = createAdminClient();
  const { error } = await db.from("agent_webhooks").upsert({
    agent_id: agent.id,
    url,
    secret,
    secret_hint: secret ? secret.slice(0, 5) + "..." + secret.slice(-4) : "none",
    enabled: true,
    last_status: null,
    last_error: null,
  });
  if (error) throw new DoorError(500, "Could not save the wake hook");
  const test = (await wakeAgent(agent.id, "test")) as { ok: boolean; status?: number; error?: string | null };
  return {
    ok: test.ok,
    message: test.ok
      ? "Saved. A test wake was sent; your routine should run now and reply in chat."
      : `Saved, but the test wake failed (${test.status || "no response"}${test.error ? ": " + test.error : ""}). Check the address and key.`,
  };
}
