"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Command Hub</h1>
        <p className="mt-1 text-sm text-quiet">Sign in with the email your account was set up with.</p>
      </div>
      {params.get("error") === "not-allowed" && (
        <p role="alert" className="rounded-xl bg-warn-soft p-3 text-sm text-warn-ink">
          That email is not on the team list yet. Ask Manny to add it, then sign in again.
        </p>
      )}
      {state === "sent" ? (
        <p className="rounded-xl bg-card p-4 text-[15px]">
          Check <strong>{email}</strong> for a sign-in link. Open it on this device.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-[13px] font-semibold text-quiet">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-line bg-card px-3 text-base"
          />
          <button
            disabled={state === "sending"}
            className="h-12 rounded-full bg-accent text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {state === "sending" ? "Sending..." : "Email me a sign-in link"}
          </button>
          {state === "error" && (
            <p role="alert" className="text-sm text-bad">
              {message}
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
