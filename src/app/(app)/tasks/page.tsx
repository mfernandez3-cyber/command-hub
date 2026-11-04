import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Face, PageTitle, SectionTitle, TaskStatusPill, relative } from "@/components/ui";
import type { Task, TaskStatus } from "@/lib/types";

const filters: { key: string; label: string; statuses: TaskStatus[] }[] = [
  { key: "all", label: "Open", statuses: ["queued", "running", "needs_you"] },
  { key: "needs_you", label: "Needs you", statuses: ["needs_you"] },
  { key: "running", label: "In progress", statuses: ["queued", "running"] },
  { key: "done", label: "Finished", statuses: ["done", "failed", "cancelled"] },
];

const sections: { label: string; tone?: "amber"; statuses: TaskStatus[] }[] = [
  { label: "Needs you", tone: "amber", statuses: ["needs_you"] },
  { label: "Working", statuses: ["running"] },
  { label: "Queued", statuses: ["queued"] },
  { label: "Finished", statuses: ["done", "failed", "cancelled"] },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; agent?: string }>;
}) {
  const { status = "all", agent } = await searchParams;
  const filter = filters.find((f) => f.key === status) ?? filters[0];
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id, title, status, updated_at, agent_id, agents(name)")
    .in("status", filter.statuses)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (agent) query = query.eq("agent_id", agent);
  const [{ data }, agentRow] = await Promise.all([
    query,
    agent ? supabase.from("agents").select("name").eq("id", agent).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const tasks = (data ?? []) as unknown as Task[];
  const agentName = (agentRow.data as { name: string } | null)?.name;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle sub={agentName ? `Everything assigned to ${agentName}.` : "Every task, across every agent."}>
        {agentName ? `${agentName}'s tasks` : "Tasks"}
      </PageTitle>

      <nav aria-label="Filter tasks" className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-sunken p-1">
          {filters.map((f) => {
            const on = f.key === filter.key;
            return (
              <Link
                key={f.key}
                href={`/tasks?status=${f.key}${agent ? `&agent=${agent}` : ""}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-9 items-center rounded-full px-3.5 text-[14px] ${
                  on ? "bg-raised font-semibold text-ink shadow-[var(--shadow)]" : "text-ink-2 hover:text-ink"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        {agent && (
          <Link href={`/tasks?status=${filter.key}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-ink-2">
            {agentName ?? "Agent"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <span className="sr-only">Show all agents</span>
          </Link>
        )}
      </nav>

      {tasks.length === 0 && (
        <EmptyState title="Nothing here">
          {filter.key === "needs_you" ? "No task is waiting on you." : "Send an instruction from Home and it will show up here."}
        </EmptyState>
      )}

      {sections.map((s) => {
        const list = tasks.filter((t) => s.statuses.includes(t.status));
        if (list.length === 0) return null;
        return (
          <section key={s.label} className="flex flex-col gap-3">
            <SectionTitle tone={s.tone} count={list.length}>
              {s.label}
            </SectionTitle>
            <ul className={`surface divide-y divide-line-soft overflow-hidden ${s.tone === "amber" ? "ring-1 ring-amber/60" : ""}`}>
              {list.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken/40">
                    <Face name={t.agents?.name ?? "?"} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-snug">{t.title}</span>
                      <span className="block text-[13px] text-ink-3">
                        {t.agents?.name ?? "Unassigned"}, {relative(t.updated_at)}
                      </span>
                    </span>
                    {s.statuses.length > 1 && <TaskStatusPill status={t.status} />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
