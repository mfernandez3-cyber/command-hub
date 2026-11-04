"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { agentHue } from "@/components/ui";

function SendButton({ to }: { to: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-press pl-5 pr-4 text-[15px] font-semibold text-press-ink transition-transform active:scale-[0.97] disabled:opacity-60"
    >
      {pending ? "Sending..." : `Send to ${to}`}
      {!pending && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
};

export function CommandBox({
  action,
  agents,
}: {
  action: (formData: FormData) => Promise<void>;
  agents: string[];
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Longest name first so "@Claude Code" wins over "@Claude".
  const sorted = [...agents].sort((a, b) => b.length - a.length);
  const target = sorted.find((n) => text.toLowerCase().includes("@" + n.toLowerCase())) ?? "Tara";

  function pick(name: string) {
    setText((t) => {
      const cleaned = agents.reduce((acc, n) => acc.replace(new RegExp(`@${n}\\s?`, "ig"), ""), t).trimStart();
      return target === name && name !== "Tara" ? cleaned : `@${name} ${cleaned}`;
    });
    ref.current?.focus();
  }

  function dictate() {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice input isn't available in this browser. Use the mic on your keyboard instead.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setText((t) => (t ? t + " " : "") + said);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <form action={action} className="surface flex flex-col gap-4 p-4 md:p-5">
      <label htmlFor="instruction" className="sr-only">
        What do you need?
      </label>
      <textarea
        ref={ref}
        id="instruction"
        name="instruction"
        rows={3}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
        placeholder="What do you need done?"
        className="min-h-24 resize-none bg-transparent text-[19px] leading-snug outline-none placeholder:text-ink-3"
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar" role="group" aria-label="Send to">
        {agents.map((n) => {
          const on = target === n;
          return (
            <button
              type="button"
              key={n}
              onClick={() => pick(n)}
              aria-pressed={on}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[13px] font-medium transition-colors ${
                on ? "border-transparent bg-press text-press-ink" : "border-line bg-raised text-ink-2 hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="h-6 w-6 rounded-full" style={{ background: agentHue(n) }} />
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3.5">
        <button
          type="button"
          onClick={dictate}
          aria-label={listening ? "Listening" : "Speak instead"}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
            listening ? "border-transparent bg-amber text-[#2b1a00]" : "border-line text-ink-2 hover:text-ink"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <SendButton to={target} />
      </div>
    </form>
  );
}
