import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageTitle, btn, field, relative } from "@/components/ui";
import type { Memory } from "@/lib/types";

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("memory").select("*").order("updated_at", { ascending: false }).limit(200);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, " ")}%,body.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  const { data } = await query;
  const notes = (data ?? []) as Memory[];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        sub="What every agent should know: briefs, your buy box, standing decisions. Write it once here."
        action={
          <Link href="/memory/new" className={`${btn.primary} shrink-0`}>
            New note
          </Link>
        }
      >
        Memory
      </PageTitle>

      <form role="search" className="relative">
        <label htmlFor="q" className="sr-only">
          Search memory
        </label>
        <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input id="q" name="q" defaultValue={q} placeholder="Search notes" className={`${field} min-h-12 rounded-full pl-11`} />
      </form>

      {notes.length === 0 ? (
        <EmptyState title={q ? "No notes match" : "No notes yet"}>
          {q ? "Try a different word." : "Add your buy box or a bot brief so every agent works from the same facts."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {notes.map((m) => (
            <li key={m.id}>
              <Link href={`/memory/${m.id}`} className="surface flex h-full flex-col gap-2 p-5 transition-transform active:scale-[0.99]">
                <span className="display text-[18px] font-semibold leading-snug">{m.title}</span>
                <span className="line-clamp-3 text-[14px] leading-relaxed text-ink-2">{m.body}</span>
                <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full bg-sunken px-2.5 py-0.5 text-[12px] font-medium text-ink-2">
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto text-[12px] text-ink-3">{relative(m.updated_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
