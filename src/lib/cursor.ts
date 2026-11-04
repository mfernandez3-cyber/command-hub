import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { repoFromText } from "@/lib/repo";

/*
  Cursor Cloud Agents. When a task lands on the Cursor agent, the Hub launches a cloud agent on the
  repo named in the task (or CURSOR_DEFAULT_REPO), and Cursor calls back when it finishes. The Hub
  never trusts the callback body: it re-reads the agent from Cursor's API before updating the task.
*/

const API = "https://api.cursor.com/v0";

export function cursorConfigured() {
  return !!process.env.CURSOR_API_KEY;
}

function headers() {
  return { Authorization: `Bearer ${process.env.CURSOR_API_KEY}`, "Content-Type": "application/json" };
}

function signTask(taskId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CURSOR_API_KEY ?? "";
  return createHmac("sha256", secret).update("cursor:" + taskId).digest("hex").slice(0, 32);
}

export function checkTaskSignature(taskId: string, sig: string | null) {
  if (!sig) return false;
  const want = Buffer.from(signTask(taskId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

type External = { cursor?: { id: string; url?: string; repo: string; status?: string } };

async function note(taskId: string, body: string, type: "status" | "step" | "output" | "error" = "status", link?: string) {
  await createAdminClient().from("events").insert({ task_id: taskId, author: "Cursor", type, body, link: link ?? null });
}

/** Starts a Cursor cloud agent for a task, or sends a follow-up if one is already running. */
export async function runCursorTask(taskId: string, event: string, origin: string, reply?: string) {
  const db = createAdminClient();
  const { data: task } = await db.from("tasks").select("id, title, instruction, status, external").eq("id", taskId).maybeSingle();
  if (!task) return;
  const ext = (task.external ?? {}) as External;

  if (!cursorConfigured()) {
    await note(taskId, "Cursor isn't connected yet. Add CURSOR_API_KEY in Vercel to turn it on.", "error");
    return;
  }

  // A reply on a task with a live agent becomes a follow-up instruction.
  if (event === "new_reply" && ext.cursor?.id && reply) {
    const res = await fetch(`${API}/agents/${ext.cursor.id}/followup`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ prompt: { text: reply } }),
      signal: AbortSignal.timeout(15000),
    });
    await note(taskId, res.ok ? "Sent your reply to the Cursor agent." : `Couldn't send the reply to Cursor (${res.status}).`, res.ok ? "status" : "error");
    return;
  }
  if (event !== "new_task" && event !== "handed_to_you") return;
  if (ext.cursor?.id) return; // already launched

  const repo = repoFromText(task.instruction) ?? process.env.CURSOR_DEFAULT_REPO ?? null;
  if (!repo) {
    await note(taskId, 'Which repo should I work in? Reply with "repo: owner/name" or a GitHub link, then hand the task back to Cursor.', "error");
    await db.from("tasks").update({ status: "needs_you" }).eq("id", taskId);
    return;
  }

  const prompt = `${task.instruction}

Rules from the Command Hub:
- Work on a new branch and open a pull request. Never push to the main branch and never merge.
- Keep the change focused on this task. Run the project's tests or build if it has them.
- End with a short plain-language summary of what changed and anything Manny needs to check.`;

  const res = await fetch(`${API}/agents`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      prompt: { text: prompt },
      source: { repository: `https://github.com/${repo}`, ref: process.env.CURSOR_DEFAULT_BRANCH ?? "main" },
      target: { autoCreatePr: true },
      webhook: { url: `${origin}/api/integrations/cursor?task=${taskId}&sig=${signTask(taskId)}` },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    await note(taskId, `Cursor couldn't start (${res.status}): ${text}`, "error");
    await db.from("tasks").update({ status: "failed" }).eq("id", taskId);
    return;
  }
  const agent = (await res.json()) as { id: string; url?: string; status?: string; target?: { url?: string } };
  const url = agent.url ?? agent.target?.url ?? `https://cursor.com/agents?id=${agent.id}`;
  await db
    .from("tasks")
    .update({ status: "running", external: { ...ext, cursor: { id: agent.id, url, repo, status: agent.status } } })
    .eq("id", taskId);
  await note(taskId, `Started a cloud agent on ${repo}.`, "step", url);
}

/** Reads the agent from Cursor and updates the task. Safe to call any number of times. */
export async function syncCursorTask(taskId: string) {
  if (!cursorConfigured()) return;
  const db = createAdminClient();
  const { data: task } = await db.from("tasks").select("id, status, agent_id, external").eq("id", taskId).maybeSingle();
  const ext = (task?.external ?? {}) as External;
  if (!task || !ext.cursor?.id) return;
  if (!["queued", "running", "needs_you"].includes(task.status)) return;

  const res = await fetch(`${API}/agents/${ext.cursor.id}`, { headers: headers(), signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) return;
  const agent = (await res.json()) as {
    status?: string;
    summary?: string;
    target?: { prUrl?: string; url?: string };
  };
  const status = (agent.status ?? "").toUpperCase();
  if (status === ext.cursor.status) return;
  await db.from("tasks").update({ external: { ...ext, cursor: { ...ext.cursor, status } } }).eq("id", taskId);

  if (status === "FINISHED") {
    const pr = agent.target?.prUrl;
    const summary = (agent.summary ?? "Finished.").slice(0, 1500) + (pr ? " Review and merge the pull request when ready." : "");
    await db.from("tasks").update({ status: "done", result_summary: summary }).eq("id", taskId);
    await note(taskId, "Done: " + summary, "output", pr ?? ext.cursor.url);
  } else if (status === "ERROR" || status === "EXPIRED") {
    await db.from("tasks").update({ status: "failed" }).eq("id", taskId);
    await note(taskId, `The Cursor agent stopped (${status.toLowerCase()}).`, "error", ext.cursor.url);
  }
  if (task.agent_id) {
    const { count } = await db.from("tasks").select("id", { count: "exact", head: true }).eq("agent_id", task.agent_id).eq("status", "running");
    await db.from("agents").update({ status: (count ?? 0) > 0 ? "working" : "idle" }).eq("id", task.agent_id);
  }
}
