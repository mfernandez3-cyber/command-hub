import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client with full database access. Used by the agent door,
 * which checks the agent's own key before every read or write.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
