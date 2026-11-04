import Link from "next/link";
import type { AgentStatus, TaskStatus } from "@/lib/types";

/* ---------- Agent identity ---------- */

// One hue per agent. Light and dark both read against the grey ground.
const AGENT_HUES: Record<string, string> = {
  tara: "#6a4cd6",
  diana: "#c8467a",
  piper: "#1f8a5b",
  sonny: "#d9711c",
  mona: "#2f72d6",
  millie: "#a0522d",
  franky: "#0f7c86",
  ollie: "#7a8f1f",
  koby: "#b8860b",
  cursor: "#2b3a40",
  "claude code": "#c15f3c",
  polar: "#3d8fb0",
  muse: "#9b4dbb",
};

export function agentHue(name: string | null | undefined) {
  if (!name) return "#75848a";
  const key = name.toLowerCase();
  // Anyone who isn't an agent (Manny, teammates) gets the ink color.
  return AGENT_HUES[key] ?? "#56676c";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name[0]).toUpperCase();
}

/**
 * An agent's face: colored disc with initials. Working agents get a breathing ring,
 * agents waiting on Manny get an amber ring.
 */
export function Face({
  name,
  status,
  size = 40,
}: {
  name: string;
  status?: AgentStatus | null;
  size?: number;
}) {
  const hue = agentHue(name);
  const ring =
    status === "working"
      ? `0 0 0 2px var(--ground), 0 0 0 4px ${hue}`
      : status === "needs_you"
        ? "0 0 0 2px var(--ground), 0 0 0 4px var(--amber)"
        : status === "error"
          ? "0 0 0 2px var(--ground), 0 0 0 4px var(--stop)"
          : undefined;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden="true"
        className={`flex h-full w-full items-center justify-center rounded-full font-semibold text-white ${
          status === "working" ? "ring-working" : ""
        }`}
        style={{
          background: hue,
          fontSize: Math.round(size * (name.trim().includes(" ") ? 0.36 : 0.44)),
          fontFamily: "var(--font-display)",
          boxShadow: ring,
          ["--ring" as string]: `${hue}66`,
          opacity: status === "setup" || status === "paused" ? 0.45 : 1,
        }}
      >
        {initials(name)}
      </span>
    </span>
  );
}

/* ---------- Status ---------- */

const tones = {
  live: "bg-live-soft text-live",
  amber: "bg-amber-soft text-amber-ink",
  go: "bg-go-soft text-go",
  stop: "bg-stop-soft text-stop",
  quiet: "bg-sunken text-ink-2",
} as const;
type Tone = keyof typeof tones;

export function Pill({ tone, children }: { tone: Tone | "blue" | "orange" | "green" | "red" | "gray"; children: React.ReactNode }) {
  const map: Record<string, Tone> = { blue: "live", orange: "amber", green: "go", red: "stop", gray: "quiet" };
  const t = (map[tone] ?? tone) as Tone;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tones[t]}`}>
      {children}
    </span>
  );
}

const agentStatus: Record<AgentStatus, [Tone, string]> = {
  idle: ["quiet", "Ready"],
  working: ["live", "Working"],
  needs_you: ["amber", "Needs you"],
  error: ["stop", "Error"],
  paused: ["quiet", "Paused"],
  setup: ["quiet", "Not connected"],
};

export function AgentStatusPill({ status }: { status: AgentStatus }) {
  const [tone, label] = agentStatus[status];
  return <Pill tone={tone}>{label}</Pill>;
}

const taskStatus: Record<TaskStatus, [Tone, string]> = {
  queued: ["quiet", "Queued"],
  running: ["live", "Working"],
  needs_you: ["amber", "Needs you"],
  done: ["go", "Done"],
  failed: ["stop", "Failed"],
  cancelled: ["quiet", "Cancelled"],
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  const [tone, label] = taskStatus[status];
  return <Pill tone={tone}>{label}</Pill>;
}

/* ---------- Layout pieces ---------- */

export function PageTitle({ children, sub, action }: { children: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[32px] font-bold leading-[1.05] md:text-[38px]">{children}</h1>
        {sub && <p className="mt-1.5 text-[15px] text-ink-2">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, count, tone }: { children: React.ReactNode; count?: number; tone?: "amber" }) {
  return (
    <h2 className="flex items-center gap-2 text-[17px] font-semibold">
      {tone === "amber" && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber" />}
      {children}
      {count !== undefined && <span className="text-[15px] font-medium text-ink-3">{count}</span>}
    </h2>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-ink-2 hover:text-ink">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-line px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-[14px] text-ink-2">{children}</div>}
    </div>
  );
}

/* Shared button styles */
export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-press px-5 text-[15px] font-semibold text-press-ink transition-transform active:scale-[0.97] disabled:opacity-50",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-raised px-5 text-[15px] font-semibold text-ink transition-transform active:scale-[0.97] disabled:opacity-50",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-raised px-5 text-[15px] font-semibold text-stop transition-transform active:scale-[0.97]",
};

export const field =
  "min-h-11 w-full rounded-xl border border-line bg-raised px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink-3 focus:outline-none";

/* ---------- Time ---------- */

export function timeShort(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function dayLabel(iso: string) {
  const tz = "America/Chicago";
  const d = new Date(iso).toLocaleDateString("en-US", { timeZone: tz });
  const today = new Date().toLocaleDateString("en-US", { timeZone: tz });
  const yest = new Date(Date.now() - 864e5).toLocaleDateString("en-US", { timeZone: tz });
  if (d === today) return "Today";
  if (d === yest) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });
}

export function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/* Legacy export kept for older imports */
export function Avatar({ name }: { name: string; dark?: boolean }) {
  return <Face name={name} size={36} />;
}
export function SectionLabel({ children }: { children: React.ReactNode; tone?: string }) {
  return <SectionTitle>{children}</SectionTitle>;
}
