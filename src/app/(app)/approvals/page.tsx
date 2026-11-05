import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decideApprovalState } from "@/app/actions";
import { ApprovalButtons } from "@/components/approval-buttons";
import { EmptyState, Face, PageTitle, SectionTitle, btn, relative } from "@/components/ui";
import type { Approval } from "@/lib/types";

const verb: Record<Approval["action_type"], string> = {
  post: "post publicly",
  send: "send a message",
  spend: "spend money",
  merge: "merge code",
  delete: "delete something",
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
      .select("id, summary, status, decided_at, task_id, requested_by")
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(10),
  ]);
  const items = (pending ?? []) as (Approval & { details?: { text?: string } })[];

  return (
    <div className="flex flex-col gap-7">
      <PageTitle sub="Nothing public, paid, sent, merged, or deleted goes out until you say so.">Approvals</PageTitle>

      {items.length === 0 ? (
        <EmptyState title="You're all caught up">Nothing is waiting on your OK.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((a) => (
            <li key={a.id} className="surface overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line-soft bg-amber-soft/70 px-5 py-3">
                <Face name={a.requested_by} size={32} />
                <p className="min-w-0 flex-1 text-[14px]">
                  <span className="font-semibold">{a.requested_by}</span> wants to {verb[a.action_type]}
                </p>
                <span className="shrink-0 text-[12px] text-amber-ink">{relative(a.created_at)}</span>
              </div>
              <div className="flex flex-col gap-4 p-5">
                <h2 className="text-[21px] font-semibold leading-snug">{a.summary}</h2>
                {a.details?.text && (
                  <div className="whitespace-pre-wrap rounded-2xl bg-sunken px-4 py-3 text-[15px] leading-relaxed">{a.details.text}</div>
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
                  <dt className="text-ink-3">Task</dt>
                  <dd>
                    <Link href={`/tasks/${a.task_id}`} className="font-medium text-live hover:underline">
                      {a.tasks?.title ?? "Open task"}
                    </Link>
                  </dd>
                  {a.amount_usd != null && (
                    <>
                      <dt className="text-ink-3">Amount</dt>
                      <dd className="font-semibold">${Number(a.amount_usd).toFixed(2)}</dd>
                    </>
                  )}
                </dl>
                <ApprovalButtons id={a.id} action={decideApprovalState} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(decided?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Recently decided</SectionTitle>
          <ul className="surface divide-y divide-line-soft overflow-hidden">
            {decided!.map((d) => (
              <li key={d.id}>
                <Link href={`/tasks/${d.task_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/40">
                  <Face name={d.requested_by} size={28} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{d.summary}</span>
                  <span className={`shrink-0 text-[13px] font-semibold ${d.status === "approved" ? "text-go" : "text-ink-3"}`}>
                    {d.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                  <span className="hidden shrink-0 text-[12px] text-ink-3 sm:inline">{d.decided_at ? relative(d.decided_at) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
