export type AgentStatus = "idle" | "working" | "needs_you" | "error" | "paused" | "setup";
export type TaskStatus = "queued" | "running" | "needs_you" | "done" | "failed" | "cancelled";

export type Agent = {
  id: string;
  name: string;
  role: string;
  adapter: "xai" | "cursor" | "claude_code" | "browser_queue" | "manual";
  tier: "full" | "bridge";
  visibility: "team" | "owner";
  status: AgentStatus;
  sort_order: number;
};

export type Task = {
  id: string;
  title: string;
  instruction: string;
  agent_id: string | null;
  status: TaskStatus;
  priority: number;
  result_summary: string | null;
  cost_usd: number;
  created_at: string;
  updated_at: string;
  agents?: { name: string } | null;
};

export type HubEvent = {
  id: number;
  task_id: string;
  author: string;
  type: "message" | "step" | "output" | "error" | "status";
  body: string;
  link: string | null;
  created_at: string;
};

export type Approval = {
  id: string;
  task_id: string;
  action_type: "spend" | "post" | "send" | "merge" | "delete";
  summary: string;
  amount_usd: number | null;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  created_at: string;
  tasks?: { title: string; agents?: { name: string } | null } | null;
};

export type Memory = {
  id: string;
  scope: "global" | "project" | "agent";
  title: string;
  body: string;
  tags: string[];
  updated_by: string | null;
  updated_at: string;
};
