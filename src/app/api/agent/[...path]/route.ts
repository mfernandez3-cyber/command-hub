import { NextResponse } from "next/server";
import { agentForKey, keyFromRequest } from "@/lib/agent-door";
import {
  DoorError,
  askApproval,
  assignTask,
  claimTask,
  completeTask,
  listTasks,
  newTask,
  postNote,
  readMemory,
  registerWakeHook,
} from "@/lib/agent-actions";

export const dynamic = "force-dynamic";

/*
  The agent door. Every call needs the agent's key, sent one of these ways:
    Authorization: Bearer hub_...     (preferred)
    x-hub-key: hub_...
    ?key=hub_...                      (for browser-only agents)

  GET  /api/agent/me                      who am I
  GET  /api/agent/tasks                   my open tasks (Tara sees all team tasks)
  POST /api/agent/tasks                   { instruction, title?, assign_to?, priority? }
  POST /api/agent/tasks/:id/claim
  POST /api/agent/tasks/:id/note          { body, type?: message|step|output|error, link? }
  POST /api/agent/tasks/:id/complete      { summary, status?: done|failed }
  POST /api/agent/tasks/:id/assign        { to, note? }                    chief of staff only
  POST /api/agent/tasks/:id/approval      { action_type, summary, amount_usd?, details? }
  GET  /api/agent/memory?q=               shared notes
  POST /api/agent/wake-hook               { url, key }   register your own wake webhook, then a test is sent
*/

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) return (await req.json()) ?? {};
    if (type.includes("form")) return Object.fromEntries((await req.formData()).entries());
  } catch {
    throw new DoorError(400, "Could not read the request body");
  }
  return {};
}

async function handle(req: Request, path: string[], method: "GET" | "POST") {
  const body = method === "POST" ? await readBody(req) : {};
  const agent = await agentForKey(keyFromRequest(req, body));
  if (!agent) throw new DoorError(401, "Missing or wrong key");

  const [root, id, action] = path;

  if (method === "GET" && root === "me") return { name: agent.name, chief_of_staff: agent.can_route };
  if (method === "GET" && root === "tasks" && !id) return { agent: agent.name, tasks: await listTasks(agent) };
  if (method === "GET" && root === "memory") return { notes: await readMemory(agent, new URL(req.url).searchParams.get("q")) };

  if (method === "POST" && root === "wake-hook") return registerWakeHook(agent, body);
  if (method === "POST" && root === "tasks" && !id) return newTask(agent, body);
  if (method === "POST" && root === "tasks" && id) {
    switch (action) {
      case "claim":
        return claimTask(agent, id);
      case "note":
        return postNote(agent, id, body);
      case "complete":
        return completeTask(agent, id, body);
      case "assign":
        return assignTask(agent, id, body);
      case "approval":
        return askApproval(agent, id, body);
    }
  }
  throw new DoorError(404, "Unknown action");
}

async function respond(req: Request, ctx: { params: Promise<{ path: string[] }> }, method: "GET" | "POST") {
  const { path } = await ctx.params;
  // Browser forms on /agent post to ?key=...&back=1 so the agent lands back on its page.
  const back = new URL(req.url).searchParams.get("back");
  const goBack = (msg: string) => {
    const url = new URL("/agent", req.url);
    const key = new URL(req.url).searchParams.get("key");
    if (key) url.searchParams.set("key", key);
    url.searchParams.set("msg", msg);
    return NextResponse.redirect(url, 303);
  };
  try {
    const result = await handle(req, path, method);
    if (back) return goBack("Saved.");
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof DoorError ? e.status : 500;
    const message = e instanceof DoorError ? e.message : "Something went wrong";
    if (status === 500) console.error(e);
    if (back) return goBack("Error: " + message);
    return NextResponse.json({ error: message }, { status });
  }
}

export function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return respond(req, ctx, "GET");
}
export function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return respond(req, ctx, "POST");
}
