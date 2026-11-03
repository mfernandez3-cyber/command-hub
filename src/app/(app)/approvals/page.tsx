import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decideApproval } from "@/app/actions";
import { Pill, SectionLabel, relative, timeShort } from "@/components/ui";
import type { Approval } from "@/lib/types";

const typeLabel: Record<Approval["action_type"], [string, "orange" | "blue" | "red"]> = {
  post: ["Public post", "orange"],
  send: ["Send", "orange"],
  spend: ["Spend", "red"],
  merge: ["Code merge", "blue"],
  delete: ["Delete", "red"],
};

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const [{ data: pending }, { data: decided }] = await Promise.all([
    supabase
      .from("approvals")
      .select("*, tasks(title, agents(name))")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id, summary, status, decided_at, task_id")
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-quiet">Nothing public, paid, sent, merged, or deleted goes out without a tap here.</p>
      </div>

      {(pending?.length ?? 0) === 0 && (
        <p className="rounded-2xl bg-card px-4 py-5 text-sm text-quiet">All clear. Nothing is waiting on you.</p>
      )}

      {(pending as Approval[] | null)?.map((a) => {
        const [label, tone] = typeLabel[a.action_type];
        return (
          <article key={a.id} className="flex flex-col gap-3 rounded-[18px] bg-card p-4">
            <div className="flex items-center justify-between">
              <Pill tone={tone}>{label}</Pill>
              <span className="font-mono text-xs text-quiet">{timeShort(a.created_at)}</span>
            </div>
            <h2 className="text-[17px] font-semibold">{a.summary}</h2>
            <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-sm">
              <dt className="text-quiet">Requested by</dt>
              <dd>{a.requested_by}</dd>
              <dt className="text-quiet">Task</dt>
              <dd>
                <Link href={`/tasks/${a.task_id}`} className="text-accent">
                  {a.tasks?.title ?? "Open task"}
                </Link>
              </dd>
              {a.amount_usd != null && (
                <>
                  <dt className="text-quiet">Amount</dt>
                  <dd>${Number(a.amount_usd).toFixed(2)}</dd>
                </>
              )}
            </dl>
            <form action={decideApproval} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="id" value={a.id} />
              <button
                name="decision"
                value="rejected"
                className="h-12 rounded-full border border-line bg-card text-[15px] font-semibold"
              >
                Reject
              </button>
              <button name="decision" value="approved" className="h-12 rounded-full bg-accent text-[15px] font-semibold text-white">
                Approve
              </button>
            </form>
          </article>
        );
      })}

      {(decided?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Recently decided</SectionLabel>
          {decided!.map((d) => (
            <Link key={d.id} href={`/tasks/${d.task_id}`} className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="truncate">{d.summary}</span>
              <span className={`shrink-0 text-xs font-semibold ${d.status === "approved" ? "text-good" : "text-quiet"}`}>
                {d.status === "approved" ? "Approved" : "Rejected"} {d.decided_at ? relative(d.decided_at) : ""}
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
