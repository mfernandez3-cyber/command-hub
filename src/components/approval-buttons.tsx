"use client";

import { useActionState, useTransition } from "react";
import { btn } from "@/components/ui";

type State = { ok?: boolean; message?: string } | null;

export function ApprovalButtons({
  id,
  action,
}: {
  id: string;
  action: (prev: State, fd: FormData) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const [state, run, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();

  // Build the form data ourselves so the choice is always sent, whatever the browser does with button values.
  function decide(decision: "approved" | "rejected") {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("decision", decision);
    startTransition(() => run(fd));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => decide("rejected")} disabled={pending} className={`${btn.secondary} min-h-12`}>
          Reject
        </button>
        <button type="button" onClick={() => decide("approved")} disabled={pending} className={`${btn.primary} min-h-12`}>
          {pending ? "Saving..." : "Approve"}
        </button>
      </div>
      {state?.message && (
        <p role="status" className={`text-[14px] ${state.ok ? "text-go" : "text-stop"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
