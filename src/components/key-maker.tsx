"use client";

import { useActionState, useState } from "react";
import { onboardingMessage } from "@/lib/onboarding";

export function KeyMaker({
  agentId,
  agentName,
  chief,
  scheduled = false,
  forGithub = false,
  forConnector = false,
  hasKey,
  action,
}: {
  agentId: string;
  agentName: string;
  chief: boolean;
  scheduled?: boolean;
  forGithub?: boolean;
  forConnector?: boolean;
  hasKey: boolean;
  action: (prev: { key?: string; error?: string } | null, fd: FormData) => Promise<{ key?: string; error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const deskLink = state?.key ? `${origin}/agent?key=${state.key}` : "";
  const connector = state?.key ? `${origin}/api/mcp/${state.key}` : "";
  const setup = state?.key ? onboardingMessage({ name: agentName, chief, origin, key: state.key, scheduled }) : "";

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
            Copy this now. For safety, it&apos;s only shown once. Paste it into your private chat with {agentName} only,
            never a group chat or a shared doc.
          </p>
          {forConnector && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-quiet">Connector address (paste into Claude: Settings, Connectors, Add custom connector)</span>
              <code className="break-all rounded bg-card p-2 font-mono text-xs">{connector}</code>
              <button type="button" onClick={() => copy(connector, "connector")} className="h-11 rounded-full bg-press text-sm font-semibold text-press-ink">
                {copied === "connector" ? "Copied" : "Copy connector address"}
              </button>
            </div>
          )}
          {!forGithub && !forConnector && <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-quiet">Setup message (paste this whole thing to {agentName})</span>
            <textarea readOnly value={setup} rows={6} className="rounded bg-card p-2 font-mono text-xs" />
            <button type="button" onClick={() => copy(setup, "setup")} className="h-11 rounded-full bg-press text-sm font-semibold text-press-ink">
              {copied === "setup" ? "Copied" : "Copy setup message"}
            </button>
          </div>}
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
            className="h-11 w-full rounded-full bg-press text-sm font-semibold text-press-ink disabled:opacity-60"
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
