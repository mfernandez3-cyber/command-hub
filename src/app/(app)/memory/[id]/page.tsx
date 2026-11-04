import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteMemory, saveMemory } from "@/app/actions";
import { BackLink, btn, field } from "@/components/ui";
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
    <div className="flex flex-col gap-5">
      <BackLink href="/memory">Memory</BackLink>
      <form action={saveMemory} className="surface flex flex-col gap-4 p-5">
        {!isNew && <input type="hidden" name="id" value={id} />}
        <label className="sr-only" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={note?.title}
          placeholder="Note title"
          className="display bg-transparent text-[26px] font-bold leading-tight outline-none placeholder:text-ink-3"
        />
        <label className="sr-only" htmlFor="body">
          Note
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={14}
          defaultValue={note?.body}
          placeholder="Write what every agent should know."
          className="resize-y bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-ink-3"
        />
        <label className="flex flex-col gap-1.5 border-t border-line-soft pt-4 text-[13px] font-medium text-ink-2">
          Tags, separated by commas
          <input name="tags" defaultValue={note?.tags.join(", ")} placeholder="buy box, diana" className={field} />
        </label>
        <button className={btn.primary}>{isNew ? "Save note" : "Save changes"}</button>
      </form>
      {!isNew && (
        <form action={deleteMemory}>
          <input type="hidden" name="id" value={id} />
          <button className={`${btn.danger} w-full`}>Delete note</button>
        </form>
      )}
    </div>
  );
}
