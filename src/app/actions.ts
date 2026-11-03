"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
      body: agent ? `Assigned to ${agent.name}. Waiting for it to pick up.` : "No agent assigned yet.",
    },
  ]);

  revalidatePath("/");
  redirect(`/tasks/${task.id}`);
}

export async function replyToTask(formData: FormData) {
  const taskId = String(formData.get("taskId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const { supabase, name } = await me();
  await supabase.from("events").insert({ task_id: taskId, author: name, type: "message", body });
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

export async function decideApproval(formData: FormData) {
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  if (decision !== "approved" && decision !== "rejected") return;
  const { supabase, profile } = await me();
  await supabase
    .from("approvals")
    .update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  revalidatePath("/approvals");
  revalidatePath("/tasks");
  revalidatePath("/");
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
