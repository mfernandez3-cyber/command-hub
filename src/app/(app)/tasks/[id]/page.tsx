import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { replyToTask, requestApproval, setTaskStatus } from "@/app/actions";
import { TaskStatusPill, timeShort } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";
import type { HubEvent, Task } from "@/lib/types";

const eventTone: Record<HubEvent["type"], string> = {
  message: "",
  step: "text-quiet",
  output: "",
  error: "text-bad",
  status: "text-quiet",
};

export default async function TaskThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // If a Cursor run is attached and still open, check on it (backup for a missed callback).
  try {
    const { syncCursorTask } = await import("@/lib/cursor");
    await syncCursorTask(id);
  } catch {}
  const [{ data: task }, { data: events }, { data: pending }] = await Promise.all([
    supabase.from("tasks").select("*, agents(name)").eq("id", id).maybeSingle(),
    supabase.from("events").select("*").eq("task_id", id).order("created_at"),
    supabase.from("approvals").select("id, summary").eq("task_id", id).eq("status", "pending"),
  ]);
  if (!task) notFound();
  const t = task as Task;

  const open = ["queued", "running", "needs_you"].includes(t.status);

  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh taskId={id} />
      <div className="flex flex-col gap-1.5">
        <Link href="/tasks" className="text-sm font-medium text-accent">
          ‹ Tasks
        </Link>
        <h1 className="text-xl font-bold leading-tight">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-quiet">
          <TaskStatusPill status={t.status} />
          <span>{t.agents?.name ?? "Unassigned"}</span>
          <span>· cost so far ${Number(t.cost_usd).toFixed(2)}</span>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {(events as HubEvent[] | null)?.map((e) => (
          <li key={e.id} className="flex gap-2.5">
            <span className="w-14 shrink-0 pt-0.5 font-mono text-xs text-quiet">{timeShort(e.created_at)}</span>
            <div className={`flex-1 text-sm ${eventTone[e.type]}`}>
              {e.author !== "system" && <strong className="text-ink">{e.author} </strong>}
              <span className="whitespace-pre-wrap">{e.body}</span>
              {e.link && (
                <a href={e.link} target="_blank" rel="noreferrer" className="ml-1 text-accent underline">
                  Open
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      {(pending?.length ?? 0) > 0 && (
        <Link
          href="/approvals"
          className="rounded-2xl border border-warn-line bg-warn-soft px-3.5 py-3 text-sm font-semibold text-warn-ink"
        >
          {pending!.length} approval{pending!.length > 1 ? "s" : ""} waiting: {pending![0].summary}
        </Link>
      )}

      {open && (
        <div className="flex flex-wrap gap-2">
          {t.status !== "running" && (
            <StatusButton taskId={id} status="running" label="Mark running" />
          )}
          <StatusButton taskId={id} status="done" label="Mark done" primary />
          <StatusButton taskId={id} status="cancelled" label="Cancel" />
        </div>
      )}
      {!open && <StatusButton taskId={id} status="queued" label="Reopen" />}

      {open && (
        <details className="rounded-2xl bg-card px-3.5 py-3">
          <summary className="cursor-pointer text-sm font-semibold">Request an approval</summary>
          <form action={requestApproval} className="mt-3 flex flex-col gap-2.5">
            <input type="hidden" name="taskId" value={id} />
            <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
              Type
              <select name="actionType" className="h-11 rounded-xl border border-line bg-card px-3 text-[15px] text-ink">
                <option value="post">Public post</option>
                <option value="send">Send a message or email</option>
                <option value="spend">Spend money</option>
                <option value="merge">Merge code</option>
                <option value="delete">Delete something</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
              What needs approving
              <input name="summary" required className="h-11 rounded-xl border border-line px-3 text-[15px] text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
              Amount in dollars (optional)
              <input name="amount" inputMode="decimal" className="h-11 rounded-xl border border-line px-3 text-[15px] text-ink" />
            </label>
            <button className="h-11 rounded-full bg-ink text-sm font-semibold text-white">Send to Approvals</button>
          </form>
        </details>
      )}

      <form
        action={replyToTask}
        className="sticky bottom-28 flex items-center gap-2 rounded-full border border-line bg-card p-1.5 pl-4"
      >
        <input type="hidden" name="taskId" value={id} />
        <label htmlFor="reply" className="sr-only">
          Reply to this task
        </label>
        <input
          id="reply"
          name="body"
          required
          autoComplete="off"
          placeholder="Reply, redirect, or add context"
          className="h-10 flex-1 bg-transparent text-[15px] outline-none"
        />
        <button aria-label="Send reply" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function StatusButton({
  taskId,
  status,
  label,
  primary = false,
}: {
  taskId: string;
  status: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value={status} />
      <button
        className={`h-11 rounded-full px-4 text-sm font-semibold ${
          primary ? "bg-accent text-white" : "border border-line bg-card text-ink"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
