import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAgentKey, removeAgent, removeWakeHook, revokeAgentKey, saveWakeHook, testWakeHook } from "@/app/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { WakeHookForm } from "@/components/wake-hook-form";
import { AgentStatusPill, BackLink, Face, btn, relative } from "@/components/ui";
import { KeyMaker } from "@/components/key-maker";
import { connectionCheck } from "@/lib/connections";
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
  const real = await connectionCheck();
  const a = { ...(agent as Agent & { can_route: boolean; last_seen_at: string | null }) };
  a.status = real(a);
  const isOwner = profile?.role === "owner";
  const cursorOn = !!process.env.CURSOR_API_KEY;
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
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/agents">Team</BackLink>
        <div className="mt-3 flex items-center gap-4">
          <Face name={a.name} status={a.status} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[30px] font-bold leading-none">{a.name}</h1>
            <p className="mt-1.5 text-[15px] text-ink-2">
              {a.role}
              {a.can_route && !/chief of staff/i.test(a.role) ? ", chief of staff" : ""}
              {a.visibility === "owner" ? ", private to you" : ""}
            </p>
          </div>
          <AgentStatusPill status={a.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/tasks?agent=${a.id}`} className="surface flex flex-col gap-1 p-4">
          <span className="display text-[28px] font-bold leading-none">{open ?? 0}</span>
          <span className="text-[14px] text-ink-2">Open tasks</span>
        </Link>
        <div className="surface flex flex-col gap-1 p-4">
          <span className="display text-[20px] font-semibold leading-tight">{a.last_seen_at ? relative(a.last_seen_at) : "Never"}</span>
          <span className="text-[14px] text-ink-2">Last checked in</span>
        </div>
      </div>

      {isOwner && a.adapter === "cursor" && (
        <Panel title="Connection">
          <p className={`text-[15px] ${cursorOn ? "text-go" : "text-ink-2"}`}>
            {cursorOn
              ? "Connected. Tasks for Cursor start a cloud agent right away and come back with a pull request."
              : "Not connected yet. Add CURSOR_API_KEY in Vercel under Settings, Environment Variables, then redeploy."}
          </p>
          <p className="text-[14px] text-ink-3">
            Name the repo in the task with a GitHub link or &quot;repo: owner/name&quot;. Default repo:{" "}
            {process.env.CURSOR_DEFAULT_REPO ?? "none set"}.
          </p>
        </Panel>
      )}

      {isOwner && a.adapter !== "cursor" && a.adapter !== "manual" && (
        <Panel
          title="Connection key"
          note={`Lets ${a.name} pick up tasks, post updates, and ask you for approvals. It can never approve anything itself.`}
        >
          {key && (
            <p className="rounded-xl bg-sunken px-3.5 py-2.5 text-[14px]">
              Key ending <span className="font-semibold">{key.key_hint.slice(-4)}</span>, made {relative(key.created_at)}, last used{" "}
              {key.last_used_at ? relative(key.last_used_at) : "never"}.
            </p>
          )}
          <KeyMaker
            agentId={a.id}
            agentName={a.name}
            chief={a.can_route}
            scheduled={a.adapter === "browser_queue"}
            forGithub={a.adapter === "claude_code"}
            hasKey={!!key}
            action={createAgentKey}
          />
          {key && (
            <form action={revokeAgentKey}>
              <input type="hidden" name="agentId" value={a.id} />
              <button className={`${btn.danger} w-full`}>Turn off this key</button>
            </form>
          )}
        </Panel>
      )}

      {isOwner && a.adapter !== "cursor" && a.adapter !== "browser_queue" && (
        <Panel
          title="Wake-up"
          note={
            a.adapter === "manual"
              ? `Starts a fresh ${a.name} session the moment there's something to do. Paste the API trigger web address and token from the routine at claude.ai/code/routines.`
              : `Starts ${a.name} the moment there's something to do: a new task, a handoff, your reply, or an approval decision.`
          }
        >
          {hook && (
            <p className={`rounded-xl px-3.5 py-2.5 text-[14px] ${hook.last_error ? "bg-stop-soft text-stop" : "bg-go-soft text-go"}`}>
              {hook.last_sent_at
                ? hook.last_error
                  ? `Last try ${relative(hook.last_sent_at)} failed (${hook.last_status || "no response"}): ${hook.last_error}`
                  : `Connected to ${new URL(hook.url).host}. Last wake ${relative(hook.last_sent_at)} worked.`
                : `Connected to ${new URL(hook.url).host}. Not used yet.`}
            </p>
          )}
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-medium text-ink-2">
              {hook ? "Replace connection" : "Set up connection"}
              <svg className="transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="pt-2">
              <WakeHookForm agentId={a.id} hasHook={!!hook} action={saveWakeHook} />
            </div>
          </details>
          {hook && (
            <div className="grid grid-cols-2 gap-2">
              <form action={testWakeHook}>
                <input type="hidden" name="agentId" value={a.id} />
                <button className={`${btn.secondary} w-full`}>Send test</button>
              </form>
              <form action={removeWakeHook}>
                <input type="hidden" name="agentId" value={a.id} />
                <button className={`${btn.danger} w-full`}>Remove</button>
              </form>
            </div>
          )}
        </Panel>
      )}

      {isOwner && !a.can_route && (
        <details className="group px-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-ink-3 hover:text-stop">
            Remove {a.name} from the team
          </summary>
          <form action={removeAgent} className="surface mt-2 flex flex-col gap-3 p-5">
            <input type="hidden" name="agentId" value={a.id} />
            <p className="text-[14px] leading-snug text-ink-2">
              {a.name} disappears from your team and its key and wake-up stop working. Its open tasks stay, unassigned, so you
              can hand them to someone else.
            </p>
            <button className={`${btn.danger} w-full`}>Remove {a.name}</button>
          </form>
        </details>
      )}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="surface flex flex-col gap-3.5 p-5">
      <div>
        <h2 className="text-[18px] font-semibold">{title}</h2>
        {note && <p className="mt-1 text-[14px] leading-snug text-ink-2">{note}</p>}
      </div>
      {children}
    </section>
  );
}
