import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AgentStatusPill, Avatar, SectionLabel } from "@/components/ui";
import type { Agent } from "@/lib/types";

const groups: { key: string; label: string; match: (a: Agent) => boolean }[] = [
  { key: "grok", label: "Grok team · full control", match: (a) => a.adapter === "xai" },
  { key: "code", label: "Coding · full control", match: (a) => a.adapter === "cursor" || a.adapter === "claude_code" },
  { key: "bridge", label: "Browser bridge · via the Mac", match: (a) => a.tier === "bridge" },
];

export default async function AgentsPage() {
  const supabase = await createClient();
  const [{ data: agents }, { data: active }] = await Promise.all([
    supabase.from("agents").select("*").order("sort_order"),
    supabase
      .from("tasks")
      .select("agent_id, title, status")
      .in("status", ["queued", "running", "needs_you"])
      .order("updated_at", { ascending: false }),
  ]);

  const current = new Map<string, { title: string; count: number }>();
  for (const t of active ?? []) {
    if (!t.agent_id) continue;
    const c = current.get(t.agent_id);
    if (c) c.count += 1;
    else current.set(t.agent_id, { title: t.title, count: 1 });
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[30px] font-bold tracking-tight">Agents</h1>

      {groups.map((g) => {
        const list = (agents as Agent[] | null)?.filter(g.match) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={g.key} className="flex flex-col gap-1.5">
            <SectionLabel>{g.label}</SectionLabel>
            <ul
              className={`flex flex-col divide-y divide-hairline rounded-2xl bg-card ${
                g.key === "bridge" ? "border border-dashed border-[#b9bec7]" : ""
              }`}
            >
              {list.map((a) => {
                const now = current.get(a.id);
                return (
                  <li key={a.id}>
                    <Link href={`/agents/${a.id}`} className="flex items-center gap-3 px-3.5 py-3">
                      <Avatar name={a.name} dark={a.name === "Tara"} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-semibold">
                          {a.name}
                          {a.visibility === "owner" && (
                            <span className="ml-1.5 text-xs font-normal text-quiet">private</span>
                          )}
                        </span>
                        <span className="truncate text-[13px] text-quiet">
                          {now ? `${now.title}${now.count > 1 ? ` (+${now.count - 1} more)` : ""}` : a.role}
                        </span>
                      </span>
                      <AgentStatusPill status={now && a.status === "idle" ? "working" : a.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="text-[13px] text-quiet">
        Agents marked Setup are not connected yet. Grok bots go live in Phase 2, Cursor and Claude Code in Phase 3,
        Polar and Muse in Phase 4. Until then, tasks assigned to them wait in the queue and you can move them along by
        hand.
      </p>
    </div>
  );
}
