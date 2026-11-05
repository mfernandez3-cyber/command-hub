import { NextResponse, after } from "next/server";
import { checkRun, runClaudeTask } from "@/lib/claude-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Starts an instant Claude run for a task. Called by the Hub itself; signed per task. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task");
  if (!taskId || !checkRun(taskId, url.searchParams.get("sig"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const event = url.searchParams.get("event") ?? "new_task";
  const note = url.searchParams.get("note") ?? undefined;
  after(() => runClaudeTask(taskId, event, note));
  return NextResponse.json({ ok: true }, { status: 202 });
}
