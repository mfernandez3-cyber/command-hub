import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTask, signOut } from "@/app/actions";
import { Face, SectionTitle, TaskStatusPill, relative, timeShort } from "@/components/ui";
import { CommandBox } from "@/components/command-box";
import type { AgentStatus, TaskStatus } from "@/lib/types";
import { connectionCheck } from "@/lib/connections";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }));
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile, agents, approvals, active, recent] = await Promise.all([
    supabase.from("profiles").select("display_name, email").eq("id", user!.id).single(),
    supabase.from("agents").select("id, name, role, status, adapter, last_seen_at").order("sort_order"),
    supabase
      .from("approvals")
      .select("id, summary, action_type, requested_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("tasks")
      .select("id, title, status, updated_at, agent_id, agents(name)")
      .in("status", ["queued", "running", "needs_you"])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("events")
      .select("id, task_id, author, body, created_at, tasks(title)")
      .neq("author", "system")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const rawName = profile.data?.display_name ?? "";
  const first = /\d/.test(rawName) || !rawName ? "" : rawName.split(" ")[0];
  const real = await connectionCheck();
  const team = ((agents.data ?? []) as { id: string; name: string; role: string; status: AgentStatus; adapter: string; last_seen_at: string | null }[]).map((a) => ({ ...a, status: real(a) }));
  const working = new Set(
    ((active.data ?? []) as unknown as { agent_id: string | null; status: string }[])
      .filter((t) => t.status === "running")
      .map((t) => t.agent_id),
  );
  const pendingCount = approvals.data?.length ?? 0;
  const busy = team.filter((a) => a.status === "working" || working.has(a.id)).length;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold leading-[1.02] md:text-[42px]">
            {greeting()}
            {first ? `, ${first}` : ""}.
          </h1>
          <p className="mt-2 text-[15px] text-ink-2">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "thing needs" : "things need"} your OK. ${busy} ${busy === 1 ? "agent is" : "agents are"} working.`
              : busy > 0
                ? `Nothing waiting on you. ${busy} ${busy === 1 ? "agent is" : "agents are"} working.`
                : "Nothing waiting on you. The team is ready."}
          </p>
        </div>
        <form action={signOut} className="md:hidden">
          <button title="Sign out" className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" />
            </svg>
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </header>

      {/* The crew: who's on, who's busy, who needs you */}
      <section aria-label="Your team" className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
        <ul className="flex gap-4 md:flex-wrap md:gap-5">
          {team.map((a) => {
            const status: AgentStatus = working.has(a.id) && a.status === "idle" ? "working" : a.status;
            return (
              <li key={a.id}>
                <Link href={`/agents/${a.id}`} className="flex w-16 flex-col items-center gap-2 text-center">
                  <Face name={a.name} status={status} size={52} />
                  <span className={`w-full truncate text-[12px] ${status === "setup" ? "text-ink-3" : "font-medium"}`}>{a.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <CommandBox action={createTask} agents={team.filter((a) => a.status !== "setup").map((a) => a.name)} />

      {pendingCount > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionTitle tone="amber" count={pendingCount}>
              Waiting on you
            </SectionTitle>
            <Link href="/approvals" className="text-[14px] font-medium text-ink-2 hover:text-ink">
              Review all
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {approvals.data!.map((a) => (
              <li key={a.id}>
                <Link href="/approvals" className="flex items-center gap-3 rounded-2xl border border-amber/60 bg-amber-soft px-4 py-3.5">
                  <Face name={a.requested_by} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{a.summary}</span>
                    <span className="block text-[13px] text-amber-ink">
                      {a.requested_by} wants to {a.action_type === "merge" ? "merge code" : a.action_type}
                    </span>
                  </span>
                  <span className="text-[13px] font-semibold text-amber-ink">Review</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionTitle>In progress</SectionTitle>
            <Link href="/tasks" className="text-[14px] font-medium text-ink-2 hover:text-ink">
              All tasks
            </Link>
          </div>
          {(active.data?.length ?? 0) === 0 ? (
            <p className="text-[15px] text-ink-2">No open tasks. Send one above to get started.</p>
          ) : (
            <ul className="surface divide-y divide-line-soft overflow-hidden">
              {((active.data ?? []) as unknown as { id: string; title: string; status: TaskStatus; updated_at: string; agents: { name: string } | null }[]).map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken/40">
                    <Face name={t.agents?.name ?? "?"} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{t.title}</span>
                      <span className="block text-[13px] text-ink-3">
                        {t.agents?.name ?? "Unassigned"}, {relative(t.updated_at)}
                      </span>
                    </span>
                    <TaskStatusPill status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Latest from the team</SectionTitle>
          {(recent.data?.length ?? 0) === 0 ? (
            <p className="text-[15px] text-ink-2">Updates from your agents will show up here.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {((recent.data ?? []) as unknown as { id: number; task_id: string; author: string; body: string; created_at: string; tasks: { title: string } | null }[]).map((e) => (
                <li key={e.id}>
                  <Link href={`/tasks/${e.task_id}`} className="flex gap-3">
                    <Face name={e.author} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold">{e.author}</span>
                        <span className="shrink-0 text-[12px] text-ink-3">{timeShort(e.created_at)}</span>
                      </span>
                      <span className="line-clamp-2 text-[14px] leading-snug text-ink-2">{e.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
