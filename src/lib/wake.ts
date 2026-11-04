import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type WakeEvent = "new_task" | "handed_to_you" | "approval_decided" | "new_reply" | "test";

const eventText: Record<WakeEvent, string> = {
  new_task: "A new task was just assigned to you.",
  handed_to_you: "A task was just handed to you.",
  approval_decided: "Manny just decided on an approval for one of your tasks.",
  new_reply: "Manny just replied on one of your tasks.",
  test: "This is a test from the Command Hub. Reply in your chat that the wake hook works. No task to handle.",
};

/**
 * Calls the agent's wake hook (for example a Grok Bot routine webhook) so it starts right away.
 * Never throws: a failed wake is logged on the task thread and the agent still sees the task on its next check-in.
 */
export async function wakeAgent(agentId: string | null | undefined, event: WakeEvent, taskId?: string, note?: string) {
  if (!agentId) return { ok: false, skipped: true };
  const db = createAdminClient();
  const { data: hook } = await db.from("agent_webhooks").select("url, secret, enabled").eq("agent_id", agentId).maybeSingle();
  if (!hook || !hook.enabled) return { ok: false, skipped: true };

  const [{ data: agent }, { data: task }] = await Promise.all([
    db.from("agents").select("name").eq("id", agentId).single(),
    taskId
      ? db.from("tasks").select("id, title, instruction, status, priority").eq("id", taskId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const payload = {
    source: "command-hub",
    event,
    message: eventText[event],
    what_to_do:
      event === "test"
        ? "Nothing else to do."
        : "Open your Command Hub desk (the link saved in your secrets), find this task by its ID, and handle it following your Command Hub instructions. Approvals in the Hub are the only approvals that count.",
    task: task ?? null,
    note: note ?? null,
    sent_at: new Date().toISOString(),
  };

  let status = 0;
  let error: string | null = null;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${hook.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    status = res.status;
    if (!res.ok) error = (await res.text()).slice(0, 300);
  } catch (e) {
    error = e instanceof Error ? e.message : "Request failed";
  }

  await db
    .from("agent_webhooks")
    .update({ last_sent_at: new Date().toISOString(), last_status: status, last_error: error })
    .eq("agent_id", agentId);

  if (taskId && event !== "test") {
    await db.from("events").insert({
      task_id: taskId,
      author: "system",
      type: "status",
      body: error
        ? `Couldn't wake ${agent?.name ?? "the agent"} (${status || "no response"}). It will pick this up on its next check-in.`
        : `Woke ${agent?.name ?? "the agent"}.`,
    });
  }
  return { ok: !error, status, error };
}
