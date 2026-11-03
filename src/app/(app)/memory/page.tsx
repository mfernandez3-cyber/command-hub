import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { relative } from "@/components/ui";
import type { Memory } from "@/lib/types";

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("memory").select("*").order("updated_at", { ascending: false }).limit(200);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, " ")}%,body.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  const { data } = await query;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h1 className="text-[30px] font-bold tracking-tight">Memory</h1>
        <Link href="/memory/new" className="flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
          + New note
        </Link>
      </div>
      <p className="text-sm text-quiet">
        Shared context every agent reads: bot briefs, the buy box, standing decisions. Write it once here instead of
        re-explaining it in every chat.
      </p>

      <form role="search">
        <label htmlFor="q" className="sr-only">
          Search memory
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search notes"
          className="h-11 w-full rounded-full border border-line bg-card px-4 text-[15px]"
        />
      </form>

      <ul className="flex flex-col gap-2">
        {(data as Memory[] | null)?.map((m) => (
          <li key={m.id}>
            <Link href={`/memory/${m.id}`} className="flex flex-col gap-1 rounded-2xl bg-card px-3.5 py-3">
              <span className="text-[15px] font-semibold">{m.title}</span>
              <span className="line-clamp-2 text-[13px] text-quiet">{m.body}</span>
              <span className="text-xs text-quiet">
                {m.tags.map((t) => `#${t}`).join(" ")} {m.tags.length > 0 && "·"} {m.updated_by ?? "?"},{" "}
                {relative(m.updated_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {(data?.length ?? 0) === 0 && <p className="text-sm text-quiet">No notes match.</p>}
    </div>
  );
}
