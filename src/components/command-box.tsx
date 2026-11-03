"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="flex h-11 items-center rounded-full bg-accent px-5 text-[15px] font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Sending..." : "Send to Tara"}
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

  function mention(name: string) {
    const tag = "@" + name;
    setText((t) => (t.includes(tag) ? t : `${tag} ${t}`.trimEnd() + " "));
    ref.current?.focus();
  }

  function dictate() {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice input isn't supported in this browser. Use the keyboard's mic button instead.");
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

  const quick = ["Diana", "Piper", "Cursor", "Claude Code", "Polar"].filter((n) => agents.includes(n));

  return (
    <form action={action} className="flex flex-col gap-3 rounded-[18px] bg-card p-4 shadow-[0_1px_0_var(--color-line)]">
      <label htmlFor="instruction" className="text-[13px] font-semibold text-quiet">
        Tell Tara what you need
      </label>
      <textarea
        ref={ref}
        id="instruction"
        name="instruction"
        rows={3}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Post the Grand Prairie deal to the cash buyer groups. @Diana drafts first."
        className="resize-none bg-transparent text-base outline-none placeholder:text-quiet/70"
      />
      <div className="flex flex-wrap gap-1.5">
        {quick.map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => mention(n)}
            className="min-h-8 rounded-full bg-accent-soft px-3 text-xs font-medium text-accent"
          >
            @{n}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={dictate}
          aria-label={listening ? "Listening" : "Speak instead"}
          className={`flex h-11 w-11 items-center justify-center rounded-full border ${
            listening ? "border-accent bg-accent-soft" : "border-line bg-card"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <SendButton />
      </div>
    </form>
  );
}
