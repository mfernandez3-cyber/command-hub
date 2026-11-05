import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHeartbeat } from "@/lib/wake";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called every minute by Supabase (pg_cron + pg_net). The token lives in the hub_settings table. */
export async function POST(req: NextRequest) {
  const given = req.headers.get("x-heartbeat-token") ?? "";
  const { data } = await createAdminClient().from("hub_settings").select("value").eq("key", "heartbeat_token").maybeSingle();
  const want = data?.value ?? "";
  const ok = want.length > 0 && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
  if (!ok) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const result = await runHeartbeat();
  return NextResponse.json(result);
}
