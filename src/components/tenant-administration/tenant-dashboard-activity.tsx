"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  activityFilterOptions,
  buildActivityFeed,
  compactRelativeTime,
  type ActivityFeedRow,
  type ActivityFilter,
  type DashboardActivityEvent,
} from "@/components/tenant-administration/dashboard-activity";

export function TenantActivityList({ rows }: { rows: readonly ActivityFeedRow[] }) {
  return (
    <ol className="divide-y">
      {rows.map((row) => (
        <li key={row.id}>
          <ActivityRow row={row} />
        </li>
      ))}
    </ol>
  );
}

export function TenantDashboardActivity({
  events,
  periodLabel,
  periodFrom,
  periodTo,
}: {
  events: readonly DashboardActivityEvent[];
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const feed = useMemo(() => buildActivityFeed(events, filter), [events, filter]);
  const activityHref = `/admin/activity?from=${encodeURIComponent(periodFrom)}&to=${encodeURIComponent(periodTo)}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <CardTitle className="text-base leading-6">Activity</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</p>
        </div>
        <Select
          className="h-8 w-[10.5rem] min-h-8 px-2 text-xs"
          aria-label="Filter activity"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ActivityFilter)}
        >
          {activityFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent className="px-0 pb-3 pt-0">
        {feed.rows.length === 0 ? (
          <div className="border-t px-4 py-6 sm:px-5">
            {events.length === 0 ? (
              <EmptyState
                title="No activity in this period"
                description="Tenant audit events in the selected range will appear here."
              />
            ) : (
              <p className="text-sm text-muted-foreground">No matching activity for this filter.</p>
            )}
          </div>
        ) : (
          <div className="max-h-[18rem] overflow-y-auto border-t">
            <TenantActivityList rows={feed.rows} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-5">
          {feed.hiddenCount > 0 ? (
            <p className="text-xs text-muted-foreground">+ {feed.hiddenCount} more activities</p>
          ) : (
            <span />
          )}
          <Link
            href={activityHref}
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all activity
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ row }: { row: ActivityFeedRow }) {
  if (row.kind === "auth-group") {
    return (
      <article className="grid min-h-11 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2 px-4 py-2 sm:px-5">
        <LogIn className="mt-0.5 size-3.5 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">Authentication activity</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.actor} · {row.eventCount} events
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.summary.map((item) => `${item.title} ×${item.count}`).join(" · ")}
          </p>
        </div>
        <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={row.createdAt}>
          {compactRelativeTime(row.createdAt)}
        </time>
      </article>
    );
  }

  const Icon = iconFor(row);
  const muted = row.emphasis === "muted";
  return (
    <article className="grid min-h-11 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2 px-4 py-2 sm:px-5">
      <Icon
        className={cn("mt-0.5 size-3.5", muted ? "text-muted-foreground" : "text-primary")}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={cn("truncate text-sm", muted ? "font-normal text-muted-foreground" : "font-medium")}>
          {row.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{row.actor}</p>
      </div>
      <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={row.createdAt}>
        {compactRelativeTime(row.createdAt)}
      </time>
    </article>
  );
}

function iconFor(row: Extract<ActivityFeedRow, { kind: "event" }>) {
  const key = row.title.toLowerCase();
  if (key.includes("logged out")) return LogOut;
  if (key.includes("logged in")) return LogIn;
  if (key.includes("created")) return Plus;
  if (key.includes("updated") || key.includes("assigned")) return Pencil;
  if (key.includes("client") || key.includes("employee")) return Users;
  return FileText;
}
