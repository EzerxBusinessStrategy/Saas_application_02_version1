export type DashboardActivityEvent = {
  id: string;
  action: string;
  label: string;
  resourceType: string;
  actor: string;
  createdAt: string;
};

export type ActivityFilter =
  | "all"
  | "changes"
  | "auth"
  | "clients"
  | "services"
  | "tasks";

export type ActivityCategory = "auth" | "clients" | "services" | "tasks" | "changes";

export type ActivityFeedRow =
  | {
      kind: "event";
      id: string;
      title: string;
      actor: string;
      createdAt: string;
      category: ActivityCategory;
      emphasis: "strong" | "muted";
    }
  | {
      kind: "auth-group";
      id: string;
      actor: string;
      createdAt: string;
      eventCount: number;
      summary: readonly { title: string; count: number }[];
    };

const AUTH_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["SUPER_ADMIN", "Super admin"],
  ["TENANT_ADMIN", "Tenant"],
  ["CLIENT_USER", "Client"],
  ["MANAGER", "Manager"],
  ["EMPLOYEE", "Employee"],
  ["CLIENT", "Client"],
];

export const activityFilterOptions: ReadonlyArray<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "changes", label: "System changes" },
  { value: "auth", label: "Authentication" },
  { value: "clients", label: "Clients" },
  { value: "services", label: "Services" },
  { value: "tasks", label: "Tasks" },
];

export const visibleActivityCount = 6;

export function compactRelativeTime(value: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function compactPeriodLabel(from: string, to: string): string {
  return `${formatCompactDate(from)} – ${formatCompactDate(to)}`;
}

export function activityTitle(action: string): string {
  if (action.endsWith("_LOGGED_IN")) return `${authActorLabel(action)} logged in`;
  if (action.endsWith("_LOGGED_OUT")) return `${authActorLabel(action)} logged out`;
  const words = action.toLowerCase().split("_").filter(Boolean);
  if (words.length < 2) return sentenceCase(action.replaceAll("_", " "));
  const verb = words.at(-1) ?? "";
  const noun = words.slice(0, -1).join(" ");
  return sentenceCase(`${noun} ${verb}`);
}

export function activityCategory(event: Pick<DashboardActivityEvent, "action" | "resourceType">): ActivityCategory {
  if (isAuthAction(event.action)) return "auth";
  if (event.action.startsWith("CLIENT") || event.resourceType === "client") return "clients";
  if (event.action.startsWith("SERVICE") || event.resourceType === "service") return "services";
  if (event.action.startsWith("TASK") || event.resourceType === "task") return "tasks";
  return "changes";
}

export function buildActivityFeed(
  events: readonly DashboardActivityEvent[],
  filter: ActivityFilter,
): { rows: ActivityFeedRow[]; hiddenCount: number } {
  const filtered = events.filter((event) => matchesFilter(event, filter));
  const collapsed = collapseAuthRuns(filtered);
  return {
    rows: collapsed.slice(0, visibleActivityCount),
    hiddenCount: Math.max(0, collapsed.length - visibleActivityCount),
  };
}

function matchesFilter(event: DashboardActivityEvent, filter: ActivityFilter): boolean {
  const category = activityCategory(event);
  if (filter === "all") return true;
  if (filter === "changes") return category !== "auth";
  return category === filter;
}

function collapseAuthRuns(events: readonly DashboardActivityEvent[]): ActivityFeedRow[] {
  const rows: ActivityFeedRow[] = [];
  let index = 0;
  while (index < events.length) {
    const current = events[index];
    if (!current) break;
    if (!isAuthAction(current.action)) {
      rows.push(toEventRow(current));
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    while (
      index < events.length &&
      isAuthAction(events[index]?.action ?? "") &&
      events[index]?.actor === current.actor
    ) {
      index += 1;
    }
    const group = events.slice(start, index);
    const first = group[0];
    if (!first) continue;
    if (group.length === 1) {
      rows.push(toEventRow(first));
      continue;
    }
    const counts = new Map<string, number>();
    for (const item of group) {
      const title = activityTitle(item.action);
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    rows.push({
      kind: "auth-group",
      id: first.id,
      actor: first.actor,
      createdAt: first.createdAt,
      eventCount: group.length,
      summary: [...counts.entries()].map(([title, count]) => ({ title, count })),
    });
  }
  return rows;
}

function toEventRow(event: DashboardActivityEvent): ActivityFeedRow {
  const category = activityCategory(event);
  return {
    kind: "event",
    id: event.id,
    title: activityTitle(event.action),
    actor: event.actor,
    createdAt: event.createdAt,
    category,
    emphasis: category === "auth" ? "muted" : "strong",
  };
}

function isAuthAction(action: string): boolean {
  return action.endsWith("_LOGGED_IN") || action.endsWith("_LOGGED_OUT");
}

function authActorLabel(action: string): string {
  for (const [prefix, label] of AUTH_PREFIXES) {
    if (action.startsWith(`${prefix}_`)) return label;
  }
  return "User";
}

function sentenceCase(value: string): string {
  const normalised = value.trim().toLowerCase();
  if (!normalised) return value;
  return `${normalised[0]?.toUpperCase() ?? ""}${normalised.slice(1)}`;
}

function formatCompactDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
