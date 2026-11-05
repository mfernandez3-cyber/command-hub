"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wakeAgent } from "@/lib/wake";
import type { TaskStatus } from "@/lib/types";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, email, role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login?error=not-allowed");
  return { supabase, profile, name: profile.display_name ?? profile.email };
}

/** Finds the first @mention that matches an agent name. Longest names win, so "@Claude Code" beats "@Claude". */
function pickAgent(text: string, agents: { id: string; name: string }[]) {
  const lower = text.toLowerCase();
  const sorted = [...agents].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((a) => lower.includes("@" + a.name.toLowerCase())) ?? null;
}

function makeTitle(text: string, agentName: string | null) {
  let t = text;
  if (agentName) t = t.replace(new RegExp("@" + agentName, "ig"), "");
  t = t.replace(/\s+/g, " ").trim();
  return t.length > 80 ? t.slice(0, 77).trimEnd() + "..." : t || "Untitled task";
}

export async function createTask(formData: FormData) {
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) return;
  const { supabase, profile, name } = await me();

  const { data: agents } = await supabase.from("agents").select("id, name");
  const mentioned = pickAgent(instruction, agents ?? []);
  const tara = (agents ?? []).find((a) => a.name === "Tara") ?? null;
  const agent = mentioned ?? tara;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: makeTitle(instruction, mentioned?.name ?? null),
      instruction,
      agent_id: agent?.id ?? null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !task) throw new Error(error?.message ?? "Could not create the task");

  await supabase.from("events").insert([
    { task_id: task.id, author: name, type: "message", body: instruction },
    {
      task_id: task.id,
      author: "system",
      type: "status",
      body: agent ? `Assigned to ${agent.name}.` : "No agent assigned yet.",
    },
  ]);
  if (agent) after(() => wakeAgent(agent.id, "new_task", task.id));

  revalidatePath("/");
  redirect(`/tasks/${task.id}`);
}

export async function replyToTask(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const { supabase, name } = await me();
  await supabase.from("events").insert({ task_id: taskId, author: name, type: "message", body });
  const { data: task } = await supabase.from("tasks").select("agent_id, status").eq("id", taskId).maybeSingle();
  if (task?.agent_id && ["queued", "running", "needs_you"].includes(task.status)) {
    after(() => wakeAgent(task.agent_id, "new_reply", taskId, body));
  }
  revalidatePath(`/tasks/${taskId}`);
}

const allowedStatus: TaskStatus[] = ["queued", "running", "needs_you", "done", "failed", "cancelled"];

export async function setTaskStatus(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const status = String(formData.get("status")) as TaskStatus;
  if (!allowedStatus.includes(status)) return;
  const { supabase, name } = await me();
  await supabase.from("tasks").update({ status }).eq("id", taskId);
  await supabase
    .from("events")
    .insert({ task_id: taskId, author: name, type: "status", body: `Marked ${status.replace("_", " ")}` });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function requestApproval(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const actionType = String(formData.get("actionType"));
  const summary = String(formData.get("summary") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  if (!summary) return;
  const { supabase, name } = await me();
  await supabase.from("approvals").insert({
    task_id: taskId,
    action_type: actionType,
    summary,
    amount_usd: amountRaw ? Number(amountRaw) : null,
    requested_by: name,
  });
  await supabase.from("tasks").update({ status: "needs_you" }).eq("id", taskId);
  await supabase
    .from("events")
    .insert({ task_id: taskId, author: name, type: "status", body: `Approval requested: ${summary}` });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/approvals");
  revalidatePath("/");
}

/** Approve or reject. Returns a plain message so the page can show what happened. */
export async function decideApprovalState(
  _prev: { ok?: boolean; message?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  try {
    const id = String(formData.get("id") ?? "");
    const decision = String(formData.get("decision") ?? "");
    if (!id) return { message: "Missing approval id." };
    if (decision !== "approved" && decision !== "rejected") return { message: `Unknown choice "${decision}".` };
    const { supabase, profile } = await me();
    const change = { status: decision, decided_by: profile.id, decided_at: new Date().toISOString() };

    const { data: done, error } = await supabase
      .from("approvals")
      .update(change)
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    let saved = !error && (done?.length ?? 0) > 0;
    const detail = error ? error.message : "";
    if (!saved) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: forced, error: e2 } = await admin
        .from("approvals")
        .update(change)
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (e2) return { message: `Couldn't save: ${e2.message}${detail ? ` (first try: ${detail})` : ""}` };
      saved = (forced?.length ?? 0) > 0;
      if (!saved) {
        const { data: row, error: e3 } = await admin.from("approvals").select("status").eq("id", id).maybeSingle();
        if (e3) return { message: `Couldn't read the approval: ${e3.message}` };
        if (!row) return { message: "That approval no longer exists. Reload the page." };
        if (row.status !== "pending") {
          revalidatePath("/approvals");
          return { ok: true, message: `Already ${row.status}.` };
        }
        return { message: "The change didn't stick. Send Claude a screenshot of this message." };
      }
    }

    const { createAdminClient: adminFor } = await import("@/lib/supabase/admin");
    const { data: approval } = await adminFor()
      .from("approvals")
      .select("task_id, summary, tasks(agent_id)")
      .eq("id", id)
      .maybeSingle();
    const agentId = (approval?.tasks as unknown as { agent_id: string | null } | null)?.agent_id;
    if (approval && agentId) {
      after(() => wakeAgent(agentId, "approval_decided", approval.task_id, `${decision}: ${approval.summary}`));
    }
    revalidatePath("/approvals");
    revalidatePath("/tasks");
    revalidatePath("/");
    return { ok: true, message: decision === "approved" ? "Approved." : "Rejected." };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    return { message: `Something went wrong: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Kept for older pages that still post to it. */
export async function decideApproval(formData: FormData) {
  await decideApprovalState(null, formData);
}

export async function saveMemory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!title || !body) return;
  const { supabase, name } = await me();
  const row = { title, body, tags, updated_by: name, updated_at: new Date().toISOString() };
  if (id) await supabase.from("memory").update(row).eq("id", id);
  else await supabase.from("memory").insert({ ...row, scope: "global" });
  revalidatePath("/memory");
  redirect("/memory");
}

export async function deleteMemory(formData: FormData) {
  const id = String(formData.get("id"));
  const { supabase } = await me();
  await supabase.from("memory").delete().eq("id", id);
  revalidatePath("/memory");
  redirect("/memory");
}

/** Owner only: makes a fresh key for an agent. The old key stops working right away. */
export async function createAgentKey(
  _prev: { key?: string; error?: string } | null,
  formData: FormData,
): Promise<{ key?: string; error?: string }> {
  const agentId = String(formData.get("agentId"));
  const { supabase, profile } = await me();
  if (profile.role !== "owner") return { error: "Only the owner can create agent keys." };
  const { newKey } = await import("@/lib/agent-door");
  const { key, hash, hint } = newKey();
  const { error } = await supabase
    .from("agent_keys")
    .upsert({ agent_id: agentId, key_hash: hash, key_hint: hint, created_at: new Date().toISOString(), last_used_at: null });
  if (error) return { error: "Could not save the key. Has the 0003 database update been run?" };
  revalidatePath(`/agents/${agentId}`);
  return { key };
}

export async function revokeAgentKey(formData: FormData) {
  const agentId = String(formData.get("agentId"));
  const { supabase, profile } = await me();
  if (profile.role !== "owner") return;
  await supabase.from("agent_keys").delete().eq("agent_id", agentId);
  revalidatePath(`/agents/${agentId}`);
}

async function requireOwner() {
  const ctx = await me();
  if (ctx.profile.role !== "owner") throw new Error("Only the owner can change agent connections.");
  return ctx;
}

/** Owner only: saves the web address and secret that wake an agent (for example a Grok Bot routine webhook). */
export async function saveWakeHook(
  _prev: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireOwner();
  const agentId = String(formData.get("agentId"));
  const url = String(formData.get("url") ?? "").trim();
  let secret = String(formData.get("secret") ?? "").trim();
  if (secret.toLowerCase().startsWith("authorization:")) secret = secret.slice(14).trim();
  if (secret.toLowerCase().startsWith("bearer ")) secret = secret.slice(7).trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "That web address doesn't look right. It should start with https://" };
  }
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname))
    return { error: "The web address must start with https://" };
  // Some apps (like Polar) put the secret in the web address itself, so the key is optional.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = await createAdminClient()
    .from("agent_webhooks")
    .upsert({
      agent_id: agentId,
      url,
      secret,
      secret_hint: secret ? secret.slice(0, 5) + "..." + secret.slice(-4) : "none",
      enabled: true,
      last_status: null,
      last_error: null,
    });
  if (error) return { error: "Could not save. Has the 0004 database update been run?" };
  revalidatePath(`/agents/${agentId}`);
  return { ok: true };
}

export async function testWakeHook(formData: FormData) {
  await requireOwner();
  const agentId = String(formData.get("agentId"));
  await wakeAgent(agentId, "test");
  revalidatePath(`/agents/${agentId}`);
}

export async function removeWakeHook(formData: FormData) {
  await requireOwner();
  const agentId = String(formData.get("agentId"));
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("agent_webhooks").delete().eq("agent_id", agentId);
  revalidatePath(`/agents/${agentId}`);
}

const KINDS: Record<string, { adapter: string; tier: string }> = {
  grok: { adapter: "xai", tier: "full" },
  claude: { adapter: "manual", tier: "full" },
  checkin: { adapter: "browser_queue", tier: "bridge" },
};

/** Owner only: adds an agent to the team. */
export async function addAgent(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const { supabase } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const role = String(formData.get("role") ?? "").trim().slice(0, 80) || "Team member";
  const kind = KINDS[String(formData.get("kind"))] ?? KINDS.grok;
  const visibility = formData.get("private") ? "owner" : "team";
  if (!name) return { error: "Give the agent a name." };
  const { data, error } = await supabase
    .from("agents")
    .insert({ name, role, adapter: kind.adapter, tier: kind.tier, visibility, status: "setup", sort_order: 50 })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message.includes("duplicate") ? `There's already an agent named ${name}.` : "Couldn't add the agent." };
  revalidatePath("/agents");
  revalidatePath("/");
  redirect(`/agents/${data.id}`);
}

/** Owner only: takes an agent off the team. Its open tasks become unassigned so nothing is lost. */
export async function removeAgent(formData: FormData) {
  const { supabase, name } = await requireOwner();
  const agentId = String(formData.get("agentId"));
  const { data: agent } = await supabase.from("agents").select("name, can_route").eq("id", agentId).maybeSingle();
  if (!agent || agent.can_route) return; // never remove the chief of staff by accident
  const { data: open } = await supabase
    .from("tasks")
    .select("id")
    .eq("agent_id", agentId)
    .in("status", ["queued", "running", "needs_you"]);
  await supabase.from("tasks").update({ agent_id: null }).eq("agent_id", agentId);
  if (open?.length) {
    await supabase.from("events").insert(
      open.map((t) => ({ task_id: t.id, author: name, type: "status", body: `${agent.name} was removed from the team. This task is unassigned.` })),
    );
  }
  await supabase.from("agents").delete().eq("id", agentId);
  revalidatePath("/agents");
  revalidatePath("/");
  redirect("/agents");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
