import type { AgentStatus, TaskStatus } from "@/lib/types";

const pillStyles = {
  blue: "bg-accent-soft text-accent",
  orange: "bg-warn-soft text-warn",
  green: "bg-good-soft text-good",
  red: "bg-bad-soft text-bad",
  gray: "bg-ground text-quiet",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof pillStyles; children: React.ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${pillStyles[tone]}`}>
      {children}
    </span>
  );
}

const agentStatus: Record<AgentStatus, [keyof typeof pillStyles, string]> = {
  idle: ["gray", "Idle"],
  working: ["blue", "Working"],
  needs_you: ["orange", "Needs you"],
  error: ["red", "Error"],
  paused: ["gray", "Paused"],
  setup: ["gray", "Setup"],
};

export function AgentStatusPill({ status }: { status: AgentStatus }) {
  const [tone, label] = agentStatus[status];
  return <Pill tone={tone}>{label}</Pill>;
}

const taskStatus: Record<TaskStatus, [keyof typeof pillStyles, string]> = {
  queued: ["gray", "Queued"],
  running: ["blue", "Running"],
  needs_you: ["orange", "Needs you"],
  done: ["green", "Done"],
  failed: ["red", "Failed"],
  cancelled: ["gray", "Cancelled"],
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  const [tone, label] = taskStatus[status];
  return <Pill tone={tone}>{label}</Pill>;
}

export function Avatar({ name, dark = false }: { name: string; dark?: boolean }) {
  const initials = name.includes(" ")
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
    : name.slice(0, 2);
  return (
    <div
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold ${
        dark ? "bg-ink text-white" : "bg-[#e7ebf3] text-ink"
      }`}
    >
      {initials}
    </div>
  );
}

export function SectionLabel({ children, tone = "quiet" }: { children: React.ReactNode; tone?: "quiet" | "warn" | "accent" | "good" }) {
  const color = { quiet: "text-quiet", warn: "text-warn", accent: "text-accent", good: "text-good" }[tone];
  return <h2 className={`text-[13px] font-semibold uppercase tracking-[0.6px] ${color}`}>{children}</h2>;
}

export function timeShort(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
