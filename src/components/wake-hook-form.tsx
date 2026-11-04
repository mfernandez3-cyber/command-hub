"use client";

import { useActionState } from "react";

export function WakeHookForm({
  agentId,
  action,
  hasHook,
}: {
  agentId: string;
  hasHook: boolean;
  action: (prev: { ok?: boolean; error?: string } | null, fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const field = "h-11 rounded-xl border border-line bg-card px-3 text-[15px] text-ink";

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <input type="hidden" name="agentId" value={agentId} />
      <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
        Web address (POST to)
        <input name="url" required inputMode="url" autoComplete="off" placeholder="https://..." className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
        Key
        <input name="secret" required type="password" autoComplete="off" className={field} />
      </label>
      <button disabled={pending} className="h-11 rounded-full bg-ink text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving..." : hasHook ? "Replace wake hook" : "Save wake hook"}
      </button>
      {state?.ok && (
        <p role="status" className="text-sm text-good">
          Saved. Tap Send test below to try it.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}
