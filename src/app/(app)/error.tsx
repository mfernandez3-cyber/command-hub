"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <h1 className="text-[28px] font-bold">Something didn&apos;t go through</h1>
      <p className="max-w-prose text-[15px] text-ink-2">
        {error.message && !error.message.includes("digest")
          ? error.message
          : "The page may be out of date after an update."}{" "}
        Reload the page and try again.
      </p>
      <div className="flex gap-2">
        <button onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-press px-5 text-[15px] font-semibold text-press-ink">
          Reload page
        </button>
        <button onClick={reset} className="min-h-11 rounded-full border border-line px-5 text-[15px] font-semibold">
          Try again
        </button>
      </div>
    </div>
  );
}
