import { NextResponse } from "next/server";
import { checkTaskSignature, syncCursorTask } from "@/lib/cursor";

export const dynamic = "force-dynamic";

/** Cursor calls this when a cloud agent changes status. The body is ignored; the Hub re-reads Cursor's API. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task");
  if (!taskId || !checkTaskSignature(taskId, url.searchParams.get("sig"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  await syncCursorTask(taskId);
  return NextResponse.json({ ok: true });
}
