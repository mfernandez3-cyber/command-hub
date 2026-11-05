"use client";

import { useActionState } from "react";
import { btn } from "@/components/ui";

export function ApprovalButtons({
  id,
  action,
}: {
  id: string;
  action: (prev: { ok?: boolean; message?: string } | null, fd: FormData) => Promise<{ ok?: boolean; message?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-2.5">
        <button type="submit" name="decision" value="rejected" disabled={pending} className={`${btn.secondary} min-h-12`}>
          Reject
        </button>
        <button type="submit" name="decision" value="approved" disabled={pending} className={`${btn.primary} min-h-12`}>
          {pending ? "Saving..." : "Approve"}
        </button>
      </div>
      {state?.message && (
        <p role="status" className={`text-[14px] ${state.ok ? "text-go" : "text-stop"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
