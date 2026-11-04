import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAgentKey, removeWakeHook, revokeAgentKey, saveWakeHook, testWakeHook } from "@/app/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { WakeHookForm } from "@/components/wake-hook-form";
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
  const hook = isOwner
    ? (
        await createAdminClient()
          .from("agent_webhooks")
          .select("url, secret_hint, last_sent_at, last_status, last_error")
          .eq("agent_id", id)
          .maybeSingle()
      ).data
    : null;

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

      {isOwner && (
        <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <h2 className="text-[15px] font-semibold">Wake hook</h2>
          <p className="text-sm text-quiet">
            Starts {a.name} the moment there&apos;s something to do: a new task, a handoff, your reply, or an approval
            decision. Without it, {a.name} only sees work on its next check-in.
          </p>
          {hook && (
            <div className="flex flex-col gap-1 rounded-xl bg-ground p-3 text-sm">
              <span className="break-all">
                Sends to <code className="font-mono text-xs">{new URL(hook.url).host}</code> with key{" "}
                <code className="font-mono text-xs">{hook.secret_hint}</code>
              </span>
              <span className={hook.last_error ? "text-bad" : "text-quiet"}>
                {hook.last_sent_at
                  ? hook.last_error
                    ? `Last try ${relative(hook.last_sent_at)} failed (${hook.last_status || "no response"}): ${hook.last_error}`
                    : `Last wake ${relative(hook.last_sent_at)} worked.`
                  : "Not used yet."}
              </span>
            </div>
          )}
          <WakeHookForm agentId={a.id} hasHook={!!hook} action={saveWakeHook} />
          {hook && (
            <div className="grid grid-cols-2 gap-2">
              <form action={testWakeHook}>
                <input type="hidden" name="agentId" value={a.id} />
                <button className="h-11 w-full rounded-full border border-line text-sm font-semibold">Send test</button>
              </form>
              <form action={removeWakeHook}>
                <input type="hidden" name="agentId" value={a.id} />
                <button className="h-11 w-full rounded-full border border-line text-sm font-semibold text-bad">Remove</button>
              </form>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
