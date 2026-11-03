import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionLabel, TaskStatusPill, relative } from "@/components/ui";
import type { Task, TaskStatus } from "@/lib/types";

const filters: { key: string; label: string; statuses: TaskStatus[] }[] = [
  { key: "all", label: "Open", statuses: ["queued", "running", "needs_you"] },
  { key: "running", label: "In progress", statuses: ["queued", "running"] },
  { key: "needs_you", label: "Needs you", statuses: ["needs_you"] },
  { key: "done", label: "Done", statuses: ["done", "failed", "cancelled"] },
];

const sections: { label: string; tone: "warn" | "accent" | "quiet" | "good"; statuses: TaskStatus[] }[] = [
  { label: "Needs you", tone: "warn", statuses: ["needs_you"] },
  { label: "Running", tone: "accent", statuses: ["running"] },
  { label: "Queued", tone: "quiet", statuses: ["queued"] },
  { label: "Finished", tone: "good", statuses: ["done", "failed", "cancelled"] },
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
  const { data } = await query;
  const tasks = (data ?? []) as unknown as Task[];

  const agentName = agent ? tasks[0]?.agents?.name : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px] font-bold tracking-tight">{agentName ? `${agentName}'s tasks` : "Tasks"}</h1>

      <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/tasks?status=${f.key}${agent ? `&agent=${agent}` : ""}`}
            aria-current={f.key === filter.key ? "page" : undefined}
            className={`flex h-9 items-center rounded-full px-3.5 text-[13px] ${
              f.key === filter.key ? "bg-ink font-semibold text-white" : "border border-line bg-card"
            }`}
          >
            {f.label}
          </Link>
        ))}
        {agent && (
          <Link href={`/tasks?status=${filter.key}`} className="flex h-9 items-center px-2 text-[13px] text-accent">
            All agents
          </Link>
        )}
      </nav>

      {tasks.length === 0 && <p className="text-sm text-quiet">No tasks here.</p>}

      {sections.map((s) => {
        const list = tasks.filter((t) => s.statuses.includes(t.status));
        if (list.length === 0) return null;
        return (
          <section key={s.label} className="flex flex-col gap-1.5">
            <SectionLabel tone={s.tone}>{s.label}</SectionLabel>
            {list.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className={`flex flex-col gap-1 rounded-2xl bg-card px-3.5 py-3 ${
                  t.status === "needs_you" ? "border border-warn-line" : ""
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-semibold">{t.title}</span>
                  {s.statuses.length > 1 && <TaskStatusPill status={t.status} />}
                </span>
                <span className="text-[13px] text-quiet">
                  {t.agents?.name ?? "Unassigned"} · {relative(t.updated_at)}
                </span>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
