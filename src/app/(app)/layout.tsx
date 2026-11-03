import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/tab-bar";
import { LiveRefresh } from "@/components/live-refresh";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login?error=not-allowed");

  const { count } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-dvh">
      <LiveRefresh />
      <main className="mx-auto max-w-xl px-5 pb-32 pt-[max(env(safe-area-inset-top),28px)]">{children}</main>
      <TabBar pending={count ?? 0} />
    </div>
  );
}
