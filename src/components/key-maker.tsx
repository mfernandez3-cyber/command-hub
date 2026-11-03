"use client";

import { useActionState, useState } from "react";

export function KeyMaker({
  agentId,
  agentName,
  hasKey,
  action,
}: {
  agentId: string;
  agentName: string;
  hasKey: boolean;
  action: (prev: { key?: string; error?: string } | null, fd: FormData) => Promise<{ key?: string; error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const deskLink = state?.key ? `${origin}/agent?key=${state.key}` : "";

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      {state?.key ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warn-line bg-warn-soft p-3">
          <p className="text-sm text-warn-ink">
            Copy these now. For safety, the key is only shown once. Give them to {agentName} only, never in a group chat
            or a shared doc.
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-quiet">Key</span>
            <code className="break-all rounded bg-card p-2 font-mono text-xs">{state.key}</code>
            <button type="button" onClick={() => copy(state.key!, "key")} className="h-10 rounded-full border border-line bg-card text-sm font-semibold">
              {copied === "key" ? "Copied" : "Copy key"}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-quiet">Agent desk link (for browser agents)</span>
            <code className="break-all rounded bg-card p-2 font-mono text-xs">{deskLink}</code>
            <button type="button" onClick={() => copy(deskLink, "link")} className="h-10 rounded-full border border-line bg-card text-sm font-semibold">
              {copied === "link" ? "Copied" : "Copy desk link"}
            </button>
          </div>
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="agentId" value={agentId} />
          <button
            disabled={pending}
            className="h-11 w-full rounded-full bg-ink text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Making key..." : hasKey ? "Replace key (old one stops working)" : "Create key"}
          </button>
        </form>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
    </div>
  );
}
