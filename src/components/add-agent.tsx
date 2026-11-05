"use client";

import { useActionState, useState } from "react";
import { btn, field } from "@/components/ui";

export function AddAgent({ action }: { action: (prev: { error?: string } | null, fd: FormData) => Promise<{ error?: string }> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn.primary} shrink-0`}>
        Add agent
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="add-agent-title">
      <form action={formAction} className="surface flex w-full max-w-md flex-col gap-4 p-5">
        <h2 id="add-agent-title" className="text-[22px] font-bold">
          Add an agent
        </h2>
        <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ink-2">
          Name
          <input name="name" required autoFocus placeholder="Claude Duet" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ink-2">
          What it does
          <input name="role" placeholder="Research, docs, and deep work" className={field} />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[14px] font-medium text-ink-2">How it connects</legend>
          {[
            ["grok", "Grok bot", "Woken instantly by a webhook routine."],
            ["claude", "Claude routine", "Woken instantly through a routine at claude.ai/code."],
            ["checkin", "Checks in on a schedule", "For apps that can't be woken, like Polar or Claude Duet."],
          ].map(([value, label, note], i) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3.5 py-3 has-[:checked]:border-ink has-[:checked]:bg-sunken">
              <input type="radio" name="kind" value={value} defaultChecked={i === 0} className="mt-1" />
              <span>
                <span className="block text-[15px] font-semibold text-ink">{label}</span>
                <span className="block text-[13px] text-ink-2">{note}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2.5 text-[14px] text-ink-2">
          <input type="checkbox" name="private" />
          Private to me (hidden from Tara and the team)
        </label>
        {state?.error && (
          <p role="alert" className="text-[14px] text-stop">
            {state.error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(false)} className={btn.secondary}>
            Cancel
          </button>
          <button disabled={pending} className={btn.primary}>
            {pending ? "Adding..." : "Add agent"}
          </button>
        </div>
      </form>
    </div>
  );
}
