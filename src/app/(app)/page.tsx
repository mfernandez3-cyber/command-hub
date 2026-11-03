import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTask, signOut } from "@/app/actions";
import { SectionLabel, timeShort } from "@/components/ui";
import { CommandBox } from "@/components/command-box";

export default async function CommandPage() {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [running, needsYou, doneToday, approvals, recent, agents, profile] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "needs_you"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .gte("updated_at", startOfDay.toISOString()),
    supabase
      .from("approvals")
      .select("id, summary, action_type, requested_by")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("events")
      .select("id, task_id, author, body, created_at")
      .neq("author", "system")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("agents").select("name").order("sort_order"),
    supabase.auth.getUser().then(async ({ data }) =>
      supabase.from("profiles").select("display_name, email").eq("id", data.user!.id).single(),
    ),
  ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
  const who = profile.data?.display_name ?? profile.data?.email ?? "?";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-quiet">{today}</p>
          <h1 className="text-[30px] font-bold tracking-tight">Command</h1>
        </div>
        <form action={signOut}>
          <button
            title="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-[15px] font-semibold uppercase text-white"
          >
            {who.slice(0, 1)}
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Link href="/tasks?status=running" className="flex flex-col rounded-2xl bg-card p-3">
          <span className="text-[26px] font-bold">{running.count ?? 0}</span>
          <span className="text-[13px] text-quiet">In progress</span>
        </Link>
        <Link href="/approvals" className="flex flex-col rounded-2xl bg-warn-soft p-3">
          <span className="text-[26px] font-bold text-warn">{needsYou.count ?? 0}</span>
          <span className="text-[13px] text-warn-ink">Needs you</span>
        </Link>
        <Link href="/tasks?status=done" className="flex flex-col rounded-2xl bg-card p-3">
          <span className="text-[26px] font-bold">{doneToday.count ?? 0}</span>
          <span className="text-[13px] text-quiet">Done today</span>
        </Link>
      </div>

      <CommandBox action={createTask} agents={(agents.data ?? []).map((a) => a.name)} />

      {(approvals.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel tone="warn">Needs you</SectionLabel>
          {approvals.data!.map((a) => (
            <Link
              key={a.id}
              href="/approvals"
              className="flex items-center justify-between gap-3 rounded-2xl bg-card px-3.5 py-3"
            >
              <span className="flex flex-col">
                <span className="text-[15px] font-medium">{a.summary}</span>
                <span className="text-[13px] text-quiet">
                  {a.requested_by} · {a.action_type}
                </span>
              </span>
              <span className="text-[13px] font-semibold text-warn">Review</span>
            </Link>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>Latest activity</SectionLabel>
        {(recent.data?.length ?? 0) === 0 && (
          <p className="text-sm text-quiet">Nothing yet. Give Tara your first instruction above.</p>
        )}
        {recent.data?.map((e) => (
          <Link key={e.id} href={`/tasks/${e.task_id}`} className="flex gap-3 text-[13px] text-quiet">
            <span className="w-14 shrink-0 font-mono text-ink">{timeShort(e.created_at)}</span>
            <span className="line-clamp-2">
              <span className="font-semibold text-ink">{e.author}</span> {e.body}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
