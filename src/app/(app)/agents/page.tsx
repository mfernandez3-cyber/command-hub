import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AgentStatusPill, Face, PageTitle, SectionTitle, relative } from "@/components/ui";
import type { Agent, AgentStatus } from "@/lib/types";
import { connectionCheck } from "@/lib/connections";
import { AddAgent } from "@/components/add-agent";
import { addAgent } from "@/app/actions";

type Row = Agent & { last_seen_at: string | null; can_route: boolean };

const groups: { key: string; label: string; note: string; match: (a: Row) => boolean }[] = [
  { key: "lead", label: "Chief of staff", note: "Routes your instructions to the right agent.", match: (a) => a.can_route },
  { key: "grok", label: "Grok team", note: "Woken the moment a task lands.", match: (a) => a.adapter === "xai" && !a.can_route },
  { key: "claude", label: "Claude", note: "Started fresh the moment a task lands, with your connected apps.", match: (a) => a.adapter === "manual" },
  { key: "code", label: "Coding agents", note: "Work in your GitHub repos and open pull requests.", match: (a) => a.adapter === "cursor" || a.adapter === "claude_code" },
  { key: "mac", label: "Check in on a schedule", note: "Can't be woken from outside, so they check their desk regularly.", match: (a) => a.tier === "bridge" },
];

export default async function TeamPage() {
  const supabase = await createClient();
  const [{ data: agents }, { data: active }] = await Promise.all([
    supabase.from("agents").select("*").order("sort_order"),
    supabase
      .from("tasks")
      .select("agent_id, title, status")
      .in("status", ["queued", "running", "needs_you"])
      .order("updated_at", { ascending: false }),
  ]);

  const current = new Map<string, { title: string; count: number; running: boolean }>();
  for (const t of active ?? []) {
    if (!t.agent_id) continue;
    const c = current.get(t.agent_id);
    if (c) {
      c.count += 1;
      c.running ||= t.status === "running";
    } else current.set(t.agent_id, { title: t.title, count: 1, running: t.status === "running" });
  }
  const real = await connectionCheck();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle();
  const isOwner = me?.role === "owner";
  const rows = ((agents ?? []) as Row[]).map((a) => ({ ...a, status: real(a) }));

  return (
    <div className="flex flex-col gap-8">
      <PageTitle sub={`${rows.length} agents. Tap one to see its work or connect it.`} action={
          isOwner ? (
            <div className="flex items-center gap-2">
              <Link href="/health" className="inline-flex min-h-11 items-center rounded-full border border-line bg-raised px-4 text-[14px] font-semibold">
                System health
              </Link>
              <AddAgent action={addAgent} />
            </div>
          ) : undefined
        }>
        Team
      </PageTitle>

      {groups.map((g) => {
        const list = rows.filter(g.match);
        if (list.length === 0) return null;
        return (
          <section key={g.key} className="flex flex-col gap-3">
            <div>
              <SectionTitle>{g.label}</SectionTitle>
              <p className="text-[14px] text-ink-3">{g.note}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((a) => {
                const now = current.get(a.id);
                const status: AgentStatus = now?.running && a.status === "idle" ? "working" : a.status;
                return (
                  <li key={a.id}>
                    <Link href={`/agents/${a.id}`} className="surface flex h-full items-start gap-3.5 p-4 transition-transform active:scale-[0.99]">
                      <Face name={a.name} status={status} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="display text-[18px] font-semibold leading-tight">{a.name}</p>
                            <p className="truncate text-[13px] text-ink-3">
                              {a.role}
                              {a.visibility === "owner" ? ", private" : ""}
                            </p>
                          </div>
                          <AgentStatusPill status={status} />
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-[14px] leading-snug text-ink-2">
                          {now
                            ? `${now.title}${now.count > 1 ? `, plus ${now.count - 1} more` : ""}`
                            : a.last_seen_at
                              ? `Last checked in ${relative(a.last_seen_at)}`
                              : status === "setup"
                                ? "Not connected yet"
                                : "No open tasks"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
