import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteMemory, saveMemory } from "@/app/actions";
import type { Memory } from "@/lib/types";

export default async function MemoryEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  let note: Memory | null = null;
  if (!isNew) {
    const supabase = await createClient();
    const { data } = await supabase.from("memory").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    note = data as Memory;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/memory" className="text-sm font-medium text-accent">
        ‹ Memory
      </Link>
      <h1 className="text-xl font-bold">{isNew ? "New note" : "Edit note"}</h1>
      <form action={saveMemory} className="flex flex-col gap-3">
        {!isNew && <input type="hidden" name="id" value={id} />}
        <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
          Title
          <input
            name="title"
            required
            defaultValue={note?.title}
            className="h-11 rounded-xl border border-line bg-card px-3 text-[15px] text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
          Note
          <textarea
            name="body"
            required
            rows={12}
            defaultValue={note?.body}
            className="rounded-xl border border-line bg-card p-3 text-[15px] leading-relaxed text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-quiet">
          Tags, separated by commas
          <input
            name="tags"
            defaultValue={note?.tags.join(", ")}
            placeholder="buy box, diana"
            className="h-11 rounded-xl border border-line bg-card px-3 text-[15px] text-ink"
          />
        </label>
        <button className="h-12 rounded-full bg-accent text-[15px] font-semibold text-white">Save</button>
      </form>
      {!isNew && (
        <form action={deleteMemory}>
          <input type="hidden" name="id" value={id} />
          <button className="h-11 w-full rounded-full border border-line bg-card text-sm font-semibold text-bad">
            Delete note
          </button>
        </form>
      )}
    </div>
  );
}
