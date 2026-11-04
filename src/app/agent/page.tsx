import { agentForKey } from "@/lib/agent-door";
import { listTasks } from "@/lib/agent-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent desk", robots: { index: false, follow: false } };

/*
  A plain page for agents that work through a web browser (Tara's Grok computer, Polar).
  Open /agent?key=hub_... to see open tasks and act on them with simple forms.
*/
export default async function AgentDesk({ searchParams }: { searchParams: Promise<{ key?: string; msg?: string }> }) {
  const { key, msg } = await searchParams;
  const agent = await agentForKey(key);
  if (!agent || !key) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">Agent desk</h1>
        <p className="mt-2">Missing or wrong key. Open this page with your agent key: /agent?key=hub_...</p>
      </main>
    );
  }

  const tasks = await listTasks(agent);
  const act = (taskId: string, action: string) =>
    `/api/agent/tasks/${taskId}/${action}?back=1&key=${encodeURIComponent(key)}`;
  const field = "w-full rounded border border-line bg-card p-2 text-sm";
  const btn = "rounded-full bg-press px-4 py-2 text-sm font-semibold text-press-ink";

  return (
    <main className="mx-auto max-w-2xl p-6 text-[15px]">
      <h1 className="text-2xl font-bold">Agent desk: {agent.name}</h1>
      <p className="mt-1 text-sm text-quiet">
        {agent.can_route
          ? "You are chief of staff. You see every open team task and can hand tasks to other agents."
          : "These are the open tasks assigned to you."}{" "}
        Nothing public, paid, sent, merged, or deleted happens without an approval from Manny.
      </p>
      {msg && (
        <p role="status" className="mt-3 rounded bg-accent-soft p-2 text-sm text-accent">
          {msg}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Open tasks ({tasks.length})</h2>
        {tasks.length === 0 && <p className="mt-2 text-quiet">No open tasks right now.</p>}
        {tasks.map((t) => (
          <article key={t.id} className="mt-4 rounded-lg border border-line bg-card p-4">
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-quiet">
              Task ID: {t.id} · Status: {t.status} · Assigned to: {t.assigned_to ?? "nobody"} · Priority {t.priority}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{t.instruction}</p>
            {t.recent_messages.length > 0 && (
              <div className="mt-2 border-l-2 border-line pl-3 text-sm">
                {t.recent_messages.map((m, i) => (
                  <p key={i}>
                    <strong>{m.author}:</strong> {m.body}
                  </p>
                ))}
              </div>
            )}
            {t.approvals.length > 0 && (
              <p className="mt-2 text-sm">
                Approvals:{" "}
                {t.approvals.map((a) => `${a.summary} (${a.status})`).join("; ")}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-3">
              {t.status !== "running" && (
                <form method="post" action={act(t.id, "claim")}>
                  <button className={btn}>Start this task</button>
                </form>
              )}
              <form method="post" action={act(t.id, "note")} className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Post an update
                  <textarea name="body" rows={2} required className={field} />
                </label>
                <button className={btn}>Post update</button>
              </form>
              <form method="post" action={act(t.id, "complete")} className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Finish: what was done
                  <textarea name="summary" rows={2} required className={field} />
                </label>
                <button className={btn}>Mark done</button>
              </form>
              <form method="post" action={act(t.id, "approval")} className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Ask Manny for approval
                  <select name="action_type" className={field}>
                    <option value="send">send (email, text, message)</option>
                    <option value="post">post (public)</option>
                    <option value="spend">spend money</option>
                    <option value="merge">merge code</option>
                    <option value="delete">delete</option>
                  </select>
                </label>
                <input name="summary" required placeholder="What needs approval, in one line" className={field} />
                <textarea name="details" rows={2} placeholder="Draft or details (optional)" className={field} />
                <button className={btn}>Send to Approvals</button>
              </form>
              {agent.can_route && (
                <form method="post" action={act(t.id, "assign")} className="flex flex-col gap-1">
                  <label className="text-sm font-medium">
                    Hand to another agent (name)
                    <input name="to" required placeholder="Piper" className={field} />
                  </label>
                  <input name="note" placeholder="Note for them (optional)" className={field} />
                  <button className={btn}>Hand off</button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-lg border border-line bg-card p-4">
        <h2 className="text-lg font-semibold">Create a new task</h2>
        <form
          method="post"
          action={`/api/agent/tasks?back=1&key=${encodeURIComponent(key)}`}
          className="mt-2 flex flex-col gap-2"
        >
          <input name="title" placeholder="Short title" className={field} />
          <textarea name="instruction" rows={3} required placeholder="What needs to happen" className={field} />
          {agent.can_route && <input name="assign_to" placeholder="Assign to (agent name, optional)" className={field} />}
          <button className={btn}>Create task</button>
        </form>
      </section>
    </main>
  );
}
