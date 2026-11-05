import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retryWakeAction } from "@/app/actions";
import { EmptyState, Face, PageTitle, Pill, SectionTitle, relative } from "@/components/ui";

export const dynamic = "force-dynamic";

type Wake = {
  id: string;
  agent_id: string;
  task_id: string | null;
  event: string;
  status: "queued" | "sent" | "failed" | "skipped";
  attempts: number;
  last_status: number | null;
  last_error: string | null;
  sent_at: string | null;
  picked_up_at: string | null;
  reminded_at: string | null;
  flagged_at: string | null;
  next_attempt_at: string;
  created_at: string;
  tasks: { title: string; status: string } | null;
};

const eventLabel: Record<string, string> = {
  new_task: "New task",
  handed_to_you: "Handed over",
  approval_decided: "Approval decided",
  new_reply: "Your reply",
  test: "Test",
};

function secs(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${Math.round(m / 60)} hr`;
}

function outcome(w: Wake): [Parameters<typeof Pill>[0]["tone"], string] {
  if (w.status === "queued") return ["amber", w.attempts ? `Retrying (try ${w.attempts + 1})` : "Sending"];
  if (w.status === "failed") return ["stop", "Failed"];
  if (w.status === "skipped") return ["quiet", "No wake-up set"];
  if (w.picked_up_at) return ["go", `Started in ${secs(Date.parse(w.picked_up_at) - Date.parse(w.created_at))}`];
  if (w.event === "test") return ["go", "Delivered"];
  if (w.flagged_at && w.tasks && !["queued", "running", "needs_you"].includes(w.tasks.status)) return ["quiet", "Delivered"];
  if (w.flagged_at) return ["stop", "Never started"];
  if (w.reminded_at) return ["amber", "Reminded"];
  return ["live", "Delivered, waiting"];
}

export default async function HealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle();
  if (me?.role !== "owner") return <EmptyState title="Only Manny can see System health" />;

  const db = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const [{ data: agents }, { data: hooks }, wakesRes, { data: beat }] = await Promise.all([
    db.from("agents").select("id, name, adapter, tier, status, last_seen_at").order("sort_order"),
    db.from("agent_webhooks").select("agent_id, url, enabled, last_sent_at, last_status, last_error"),
    db.from("wakes").select("*, tasks(title, status)").gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(500),
    db.from("hub_settings").select("value").eq("key", "last_heartbeat").maybeSingle(),
  ]);
  const setUp = !wakesRes.error;
  const wakes = (wakesRes.data ?? []) as Wake[];
  const hookFor = new Map((hooks ?? []).map((h) => [h.agent_id, h]));
  const beatAge = beat?.value ? Date.now() - Date.parse(beat.value) : Infinity;
  const beating = beatAge < 3 * 60_000;
  const instantClaude = !!process.env.ANTHROPIC_API_KEY;

  function method(a: { id: string; adapter: string }) {
    if (a.adapter === "cursor") return process.env.CURSOR_API_KEY ? "Cursor API" : "Cursor API (key missing)";
    if (a.adapter === "manual" && instantClaude) return "Instant (the Hub runs it)";
    const h = hookFor.get(a.id);
    if (h?.enabled) return new URL(h.url).hostname === "api.github.com" ? "GitHub Actions" : "Webhook";
    return a.adapter === "manual" ? "Connector only (no instant wake)" : "None (checks in on its own)";
  }

  const attention = wakes.filter(
    (w) => w.event !== "test" && (w.status === "failed" || (w.flagged_at && !w.picked_up_at && w.tasks && ["queued", "running", "needs_you"].includes(w.tasks.status))),
  );
  const agentName = new Map((agents ?? []).map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageTitle sub="Is every agent getting woken up, and how fast does it start?">System health</PageTitle>

      <section className="surface flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${beating && setUp ? "bg-go" : "bg-stop"}`} />
          <p className="text-[17px] font-semibold">
            {!setUp ? "Wake log isn't set up yet" : beating ? "Automatic retries are on" : "Automatic retries are off"}
          </p>
        </div>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {!setUp
            ? "Run the 0007 database update in Supabase. Until then, wake-ups are sent once with no retries."
            : beating
              ? `The heartbeat last ran ${relative(beat!.value)}. Failed wake-ups are retried after 30 seconds, 2 minutes and 10 minutes. Agents that don't start within 5 minutes get a reminder, and you get a note on the task after 15.`
              : `The heartbeat ${beat?.value ? `last ran ${relative(beat.value)}` : "has never run"}. Retries only happen while the app is open. Run the 0007 database update in Supabase to turn on the every-minute heartbeat.`}
        </p>
      </section>

      {attention.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle tone="amber" count={attention.length}>
            Needs a look
          </SectionTitle>
          <ul className="surface divide-y divide-line-soft overflow-hidden">
            {attention.slice(0, 10).map((w) => {
              const [tone, label] = outcome(w);
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Face name={agentName.get(w.agent_id) ?? "Agent"} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {agentName.get(w.agent_id)}: {w.tasks?.title ?? eventLabel[w.event]}
                    </p>
                    <p className="truncate text-[12px] text-ink-3">
                      {relative(w.created_at)}
                      {w.last_error ? `. ${w.last_status ? w.last_status + " " : ""}${w.last_error}` : ""}
                    </p>
                  </div>
                  <Pill tone={tone}>{label}</Pill>
                  <form action={retryWakeAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="min-h-9 rounded-full border border-line bg-raised px-3.5 text-[13px] font-semibold">Wake again</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>Agents, last 7 days</SectionTitle>
        <ul className="surface divide-y divide-line-soft overflow-hidden">
          {(agents ?? []).map((a) => {
            const mine = wakes.filter((w) => w.agent_id === a.id && w.event !== "test");
            const sent = mine.filter((w) => w.status === "sent").length;
            const failed = mine.filter((w) => w.status === "failed").length;
            const starts = mine.filter((w) => w.picked_up_at).map((w) => Date.parse(w.picked_up_at!) - Date.parse(w.created_at));
            const typical = starts.length ? starts.sort((x, y) => x - y)[Math.floor(starts.length / 2)] : null;
            const last = mine[0];
            const h = hookFor.get(a.id);
            return (
              <li key={a.id}>
                <Link href={`/agents/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken/40">
                  <Face name={a.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{a.name}</p>
                    <p className="truncate text-[13px] text-ink-3">
                      {method(a)}
                      {last ? `. Last woken ${relative(last.created_at)}` : ". Not woken this week"}
                      {h?.last_error && h.last_status !== 200 ? `. Last error: ${h.last_status || "no response"}` : ""}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-[13px] sm:block">
                    <p>
                      <span className="font-semibold">{sent}</span> <span className="text-ink-3">delivered</span>
                      {failed > 0 && (
                        <>
                          {" "}
                          <span className="font-semibold text-stop">{failed}</span> <span className="text-ink-3">failed</span>
                        </>
                      )}
                    </p>
                    <p className="text-ink-3">{typical != null ? `Usually starts in ${secs(typical)}` : "No starts yet"}</p>
                  </div>
                  {last && (
                    <span className="shrink-0 sm:hidden">
                      <Pill tone={outcome(last)[0]}>{outcome(last)[1]}</Pill>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Recent wake-ups</SectionTitle>
        {wakes.length === 0 ? (
          <EmptyState title="No wake-ups yet">{setUp ? "They'll show here as you send tasks." : "Run the 0007 update first."}</EmptyState>
        ) : (
          <ul className="surface divide-y divide-line-soft overflow-hidden">
            {wakes.slice(0, 30).map((w) => {
              const [tone, label] = outcome(w);
              return (
                <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                  <Face name={agentName.get(w.agent_id) ?? "Agent"} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">
                      <span className="font-medium">{agentName.get(w.agent_id)}</span>{" "}
                      <span className="text-ink-3">{eventLabel[w.event] ?? w.event}</span>
                      {w.tasks?.title ? `: ${w.tasks.title}` : ""}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {relative(w.created_at)}
                      {w.attempts > 1 ? `. ${w.attempts} tries` : ""}
                    </p>
                  </div>
                  <Pill tone={tone}>{label}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
