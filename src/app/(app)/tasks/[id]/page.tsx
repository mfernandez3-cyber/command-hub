import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { replyToTask, requestApproval, setTaskStatus } from "@/app/actions";
import { BackLink, Face, TaskStatusPill, btn, dayLabel, field, timeShort } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";
import type { HubEvent, Task } from "@/lib/types";

export default async function TaskThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // If a Cursor run is attached and still open, check on it (backup for a missed callback).
  try {
    const { syncCursorTask } = await import("@/lib/cursor");
    await syncCursorTask(id);
  } catch {}
  const [{ data: task }, { data: events }, { data: pending }, { data: agents }] = await Promise.all([
    supabase.from("tasks").select("*, agents(name)").eq("id", id).maybeSingle(),
    supabase.from("events").select("*").eq("task_id", id).order("created_at"),
    supabase.from("approvals").select("id, summary").eq("task_id", id).eq("status", "pending"),
    supabase.from("agents").select("name"),
  ]);
  if (!task) notFound();
  const t = task as Task;
  const agentNames = new Set((agents ?? []).map((a) => a.name.toLowerCase()));
  const isAgent = (n: string) => agentNames.has(n.toLowerCase());
  const open = ["queued", "running", "needs_you"].includes(t.status);
  const owner = t.agents?.name ?? "Unassigned";

  const list = (events ?? []) as HubEvent[];
  let lastDay = "";

  return (
    <div className="flex flex-col gap-5">
      <LiveRefresh taskId={id} />
      <div>
        <BackLink href="/tasks">Tasks</BackLink>
        <div className="mt-2 flex items-start gap-3.5">
          <Face name={owner} size={46} status={t.status === "running" ? "working" : t.status === "needs_you" ? "needs_you" : null} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-tight md:text-[28px]">{t.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <TaskStatusPill status={t.status} />
              <span>Assigned to {owner}</span>
              {Number(t.cost_usd) > 0 && <span>Cost ${Number(t.cost_usd).toFixed(2)}</span>}
            </div>
          </div>
        </div>
      </div>

      {(pending?.length ?? 0) > 0 && (
        <Link href="/approvals" className="flex items-center gap-3 rounded-2xl border border-amber/60 bg-amber-soft px-4 py-3.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber" />
          <span className="min-w-0 flex-1 text-[15px]">
            <span className="font-semibold">Waiting on your OK: </span>
            {pending![0].summary}
          </span>
          <span className="text-[13px] font-semibold text-amber-ink">Review</span>
        </Link>
      )}

      <ol className="flex flex-col gap-3.5" aria-label="Task history">
        {list.map((e) => {
          const day = dayLabel(e.created_at);
          const divider =
            day !== lastDay ? (
              <li key={`d-${e.id}`} className="my-1 text-center text-[12px] font-medium text-ink-3">
                {day}
              </li>
            ) : null;
          lastDay = day;

          if (e.type === "status" || e.author === "system") {
            return [
              divider,
              <li key={e.id} className="flex items-center gap-3 px-2 text-[13px] text-ink-3">
                <span className="h-px flex-1 bg-line-soft" />
                <span className="max-w-[80%] text-center">
                  {e.author !== "system" && <span className="font-medium text-ink-2">{e.author} </span>}
                  {e.body}
                  <span className="ml-1.5">{timeShort(e.created_at)}</span>
                </span>
                <span className="h-px flex-1 bg-line-soft" />
              </li>,
            ];
          }

          if (!isAgent(e.author)) {
            return [
              divider,
              <li key={e.id} className="flex flex-col items-end gap-1 pl-10">
                <div className="max-w-full whitespace-pre-wrap rounded-[20px] rounded-br-md bg-press px-4 py-2.5 text-[15px] leading-snug text-press-ink">
                  {e.body}
                </div>
                <span className="pr-1 text-[12px] text-ink-3">{timeShort(e.created_at)}</span>
              </li>,
            ];
          }

          const bubble =
            e.type === "output"
              ? "border border-go/40 bg-go-soft"
              : e.type === "error"
                ? "border border-stop/40 bg-stop-soft"
                : e.type === "step"
                  ? "bg-sunken"
                  : "bg-raised shadow-[var(--shadow)]";
          return [
            divider,
            <li key={e.id} className="flex gap-2.5 pr-8">
              <Face name={e.author} size={30} />
              <div className="flex min-w-0 flex-col gap-1">
                <div className={`whitespace-pre-wrap rounded-[20px] rounded-tl-md px-4 py-2.5 text-[15px] leading-snug ${bubble}`}>
                  {e.body}
                  {e.link && (
                    <a href={e.link} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-live underline-offset-2 hover:underline">
                      {/github\.com\/.+\/pull\//.test(e.link) ? "Open pull request" : "Open link"}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                    </a>
                  )}
                </div>
                <span className="pl-1 text-[12px] text-ink-3">
                  {e.author}, {timeShort(e.created_at)}
                </span>
              </div>
            </li>,
          ];
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {open ? (
          <>
            <StatusButton taskId={id} status="done" label="Mark done" primary />
            {t.status !== "running" && <StatusButton taskId={id} status="running" label="Mark working" />}
            <StatusButton taskId={id} status="cancelled" label="Cancel task" danger />
          </>
        ) : (
          <StatusButton taskId={id} status="queued" label="Reopen task" />
        )}
      </div>

      {open && (
        <details className="surface group px-4 py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
            Hold something for your approval
            <svg className="transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <form action={requestApproval} className="flex flex-col gap-3 pb-4 pt-1">
            <input type="hidden" name="taskId" value={id} />
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
              What kind of action
              <select name="actionType" className={field}>
                <option value="post">Public post</option>
                <option value="send">Send a message or email</option>
                <option value="spend">Spend money</option>
                <option value="merge">Merge code</option>
                <option value="delete">Delete something</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
              What needs approving
              <input name="summary" required className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
              Amount in dollars, if any
              <input name="amount" inputMode="decimal" className={field} />
            </label>
            <button className={btn.primary}>Add to Approvals</button>
          </form>
        </details>
      )}

      <form
        action={replyToTask}
        className="sticky bottom-[92px] z-10 flex items-center gap-2 rounded-full border border-line bg-raised/95 p-1.5 pl-5 shadow-[var(--shadow)] backdrop-blur md:bottom-6"
      >
        <input type="hidden" name="taskId" value={id} />
        <label htmlFor="reply" className="sr-only">
          Reply to {owner}
        </label>
        <input
          id="reply"
          name="body"
          required
          autoComplete="off"
          placeholder={open ? `Reply to ${owner}` : "Add a note"}
          className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
        />
        <button aria-label="Send reply" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-press text-press-ink transition-transform active:scale-95">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
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
  danger = false,
}: {
  taskId: string;
  status: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value={status} />
      <button className={primary ? btn.primary : danger ? btn.danger : btn.secondary}>{label}</button>
    </form>
  );
}
