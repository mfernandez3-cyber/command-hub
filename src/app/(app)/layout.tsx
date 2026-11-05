import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/tab-bar";
import { LiveRefresh } from "@/components/live-refresh";
import { after } from "next/server";
import { runHeartbeat } from "@/lib/wake";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, email").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login?error=not-allowed");

  // Backup for the Supabase heartbeat: while the app is open, retries still go out.
  after(() => runHeartbeat({ throttleSeconds: 50 }).catch(() => {}));

  const { count } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-dvh overflow-x-clip">
      <LiveRefresh />
      <TabBar pending={count ?? 0} who={profile.email} />
      <main className="mx-auto max-w-2xl px-5 pb-36 pt-[max(env(safe-area-inset-top),24px)] md:ml-60 md:max-w-none md:px-10 md:pb-16 md:pt-10">
        <div className="mx-auto min-w-0 max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
