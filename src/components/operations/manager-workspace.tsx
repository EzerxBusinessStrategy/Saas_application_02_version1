"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, ClipboardCheck, Users } from "lucide-react";
import { getOperationalWorkspace } from "@/features/operations/api/operations-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ManagerSection =
  | "overview"
  | "clients"
  | "work-groups"
  | "employees"
  | "reviews"
  | "approvals"
  | "workload"
  | "reports"
  | "notifications"
  | "profile";

export function ManagerWorkspace({
  section = "overview",
}: {
  section?: ManagerSection;
}) {
  const query = useQuery({
    queryKey: ["manager-workspace"],
    queryFn: () => getOperationalWorkspace("manager"),
  });
  if (query.isPending)
    return <LoadingState label="Loading manager workspace" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Manager workspace could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const data = query.data;
  if (section === "reviews")
    return (
      <QueuePage
        title="Review queue"
        description="Review submitted work logs in your assigned work groups."
        items={data.workLogs
          .filter((log) => log.status === "submitted")
          .map((log) => ({
            id: log.id,
            title: `${log.employee} · ${log.durationMinutes} minutes`,
            detail: log.description,
          }))}
      />
    );
  if (section === "approvals")
    return (
      <QueuePage
        title="Approval queue"
        description="Approve or return delivery items that require your decision."
        items={data.tasks
          .filter((task) => task.approvalStatus === "pending")
          .map((task) => ({
            id: task.id,
            title: task.title,
            detail: `${task.client} · due ${task.dueDate}`,
          }))}
      />
    );
  if (section === "workload" || section === "reports")
    return (
      <ManagerWorkload
        progress={data.teamProgress}
        title={
          section === "reports" ? "Manager reports" : "Team workload and goals"
        }
      />
    );
  if (
    section === "clients" ||
    section === "work-groups" ||
    section === "employees"
  )
    return (
      <AssignedScope
        title={
          section === "clients"
            ? "Assigned clients"
            : section === "employees"
              ? "Assigned employees"
              : "Assigned work groups"
        }
        tasks={data.tasks}
      />
    );
  if (section === "notifications" || section === "profile")
    return <SimpleManagerPage section={section} />;
  const pendingReviews = data.workLogs.filter(
    (log) => log.status === "submitted",
  ).length;
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Manager"
        title="Team delivery"
        description="Only your assigned clients, work groups, employees, and delivery decisions are shown."
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Manager delivery metrics"
      >
        {[
          {
            label: "Assigned clients",
            value: String(new Set(data.tasks.map((task) => task.client)).size),
          },
          {
            label: "Open tasks",
            value: String(
              data.tasks.filter((task) => task.status !== "done").length,
            ),
          },
          { label: "Pending reviews", value: String(pendingReviews) },
          {
            label: "SLA risks",
            value: String(
              data.tasks.filter((task) => task.sla === "at-risk").length,
            ),
          },
        ].map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] lg:grid-cols-2">
        <ManagerWorkload progress={data.teamProgress} />
        <QueuePage
          title="Recent team milestones"
          description="Delivery progress within your assigned scope."
          items={data.milestones.map((milestone) => ({
            id: milestone.id,
            title: milestone.label,
            detail: `${milestone.date} · ${milestone.complete ? "Complete" : "Upcoming"}`,
          }))}
        />
      </section>
    </div>
  );
}

function QueuePage({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; title: string; detail: string }>;
}) {
  const [acted, setActed] = useState<string[]>([]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-[18px] text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="flex flex-col divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-4 first:pt-0"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {acted.includes(item.id)
                      ? "Decision recorded for this mock session."
                      : item.detail}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={acted.includes(item.id)}
                    onClick={() => setActed((current) => [...current, item.id])}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acted.includes(item.id)}
                    onClick={() => setActed((current) => [...current, item.id])}
                  >
                    Request changes
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={`No ${title.toLowerCase()}`}
            description="New assigned items will appear here."
          />
        )}
      </CardContent>
    </Card>
  );
}
function ManagerWorkload({
  progress,
  title = "Team workload and goals",
}: {
  progress: Array<{
    label: string;
    current: number;
    target: number;
    note: string;
  }>;
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-[18px] text-primary" />
          {title}
        </CardTitle>
        <CardDescription>
          Progress is based on planned delivery quality, not excessive hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-5">
          {progress.map((item) => {
            const value = Math.round((item.current / item.target) * 100);
            return (
              <li key={item.label}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.current}/{item.target} · {value}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-control)] bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.note}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
function AssignedScope({
  title,
  tasks,
}: {
  title: string;
  tasks: Array<{
    id: string;
    client: string;
    workGroup: string;
    assignee: string;
    title: string;
    sla: "on-track" | "watch" | "at-risk";
  }>;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Manager"
        title={title}
        description="Scope is limited to work assigned to you."
      />
      <Card>
        <CardContent className="pt-[30px]">
          <ul className="flex flex-col divide-y">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 py-4 first:pt-0"
              >
                <div>
                  <p className="font-medium">
                    {title === "Assigned clients"
                      ? task.client
                      : title === "Assigned employees"
                        ? task.assignee
                        : task.workGroup}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {task.title}
                  </p>
                </div>
                <StatusBadge status={task.sla} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
function SimpleManagerPage({
  section,
}: {
  section: "notifications" | "profile";
}) {
  const profile = section === "profile";
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Manager"
        title={profile ? "Profile" : "Notifications"}
        description={
          profile
            ? "Your assigned delivery identity and notification preferences."
            : "Delivery updates from your assigned work groups."
        }
      />
      <Card>
        <CardContent className="pt-[30px]">
          <p className="font-medium">
            {profile
              ? "Avery Patel"
              : "Two delivery updates need your attention"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile
              ? "Manager · GST Review and Delivery work groups"
              : "A submitted reconciliation work log and an at-risk delivery report are awaiting review."}
          </p>
          {!profile ? (
            <Button className="mt-5">
              <Bell data-icon="inline-start" />
              Mark updates reviewed
            </Button>
          ) : (
            <p className="mt-5 flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Profile details are visible only to authorised tenant users.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
