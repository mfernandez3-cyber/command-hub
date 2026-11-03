import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAgentKey, revokeAgentKey } from "@/app/actions";
import { AgentStatusPill, Avatar, relative } from "@/components/ui";
import { KeyMaker } from "@/components/key-maker";
import type { Agent } from "@/lib/types";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: agent }, { data: profile }, { data: key }, { count: open }] = await Promise.all([
    supabase.from("agents").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("agent_keys").select("key_hint, created_at, last_used_at").eq("agent_id", id).maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("agent_id", id).in("status", ["queued", "running", "needs_you"]),
  ]);
  if (!agent) notFound();
  const a = agent as Agent & { can_route: boolean; last_seen_at: string | null };
  const isOwner = profile?.role === "owner";

  return (
    <div className="flex flex-col gap-5">
      <Link href="/agents" className="text-sm font-medium text-accent">
        ‹ Agents
      </Link>
      <div className="flex items-center gap-3">
        <Avatar name={a.name} dark={a.can_route} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{a.name}</h1>
          <p className="text-sm text-quiet">
            {a.role}
            {a.can_route ? " · chief of staff" : ""}
            {a.visibility === "owner" ? " · private to you" : ""}
          </p>
        </div>
        <AgentStatusPill status={a.status} />
      </div>

      <Link href={`/tasks?agent=${a.id}`} className="flex justify-between rounded-2xl bg-card px-4 py-3 text-[15px]">
        <span>Open tasks</span>
        <span className="font-semibold">{open ?? 0} ›</span>
      </Link>

      <p className="text-sm text-quiet">
        Last checked in: {a.last_seen_at ? relative(a.last_seen_at) : "never"}
      </p>

      {isOwner && (
        <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <h2 className="text-[15px] font-semibold">Connection key</h2>
          <p className="text-sm text-quiet">
            The key lets {a.name} check the Hub for tasks, post updates, and ask you for approvals. It can never approve
            anything itself.
          </p>
          {key && (
            <p className="text-sm">
              Current key <code className="font-mono text-xs">{key.key_hint}</code>, made {relative(key.created_at)}, last
              used {key.last_used_at ? relative(key.last_used_at) : "never"}.
            </p>
          )}
          <KeyMaker agentId={a.id} agentName={a.name} hasKey={!!key} action={createAgentKey} />
          {key && (
            <form action={revokeAgentKey}>
              <input type="hidden" name="agentId" value={a.id} />
              <button className="h-10 w-full rounded-full border border-line text-sm font-semibold text-bad">
                Turn off this key
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
