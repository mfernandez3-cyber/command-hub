"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mark } from "@/components/tab-bar";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="flex flex-col gap-5">
        <Mark />
        <div>
          <h1 className="text-[36px] font-bold leading-none">Command Hub</h1>
          <p className="mt-2.5 text-[15px] text-ink-2">One place to direct every agent on your team.</p>
        </div>
      </div>
      {params.get("error") === "not-allowed" && (
        <p role="alert" className="rounded-2xl bg-amber-soft p-4 text-[14px] text-amber-ink">
          That email isn&apos;t on the team list yet. Ask Manny to add it, then sign in again.
        </p>
      )}
      {state === "sent" ? (
        <div className="surface p-5 text-[15px] leading-relaxed">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-ink-2">
            We sent a sign-in link to {email}. Open it on this device to finish signing in.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-[14px] font-medium text-ink-2">
            Your email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-raised px-4 text-[16px] text-ink focus:border-ink-3 focus:outline-none"
          />
          <button
            disabled={state === "sending"}
            className="min-h-12 rounded-full bg-press text-[15px] font-semibold text-press-ink transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {state === "sending" ? "Sending..." : "Email me a sign-in link"}
          </button>
          {state === "error" && (
            <p role="alert" className="text-[14px] text-stop">
              {/rate limit/i.test(message)
                ? "Too many sign-in emails in the last hour. Use a link already in your inbox, or try again in about an hour."
                : message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
