"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, ClipboardCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  decideEmployeeTaskReview,
  getOperationalWorkspace,
} from "@/features/operations/api/operations-api";
import { ManagerRecognition } from "@/components/operations/gamification-workflows";
import { SupportTicketWorkspace } from "@/components/operations/support-ticket-workspace";
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
  | "profile"
  | "recognition"
  | "tickets";

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
  const pendingTaskReviews = data.tasks.filter(
    (task) => task.status === "review" && task.reviewStatus === "pending",
  );
  if (section === "recognition") return <ManagerRecognition />;
  if (section === "tickets") return <SupportTicketWorkspace workspace="manager" />;
  if (section === "reviews")
    return (
      <TaskReviewQueue
        tasks={pendingTaskReviews}
        onDecision={async (taskId, decision) => {
          try {
            await decideEmployeeTaskReview(taskId, decision);
            await query.refetch();
            toast.success(
              decision === "approve"
                ? "Manager review complete. The task is awaiting tenant approval."
                : "Task returned to the employee as rejected.",
            );
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "The review decision could not be saved.",
            );
          }
        }}
      />
    );
  if ((section as string) === "reviews")
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
        title="Tenant approval tracking"
        description="Manager-approved work remains here until the Tenant Admin records the final delivery decision."
        readOnly
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
    return <SimpleManagerPage section={section} tasks={pendingTaskReviews} />;
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

function TaskReviewQueue({
  tasks,
  onDecision,
}: {
  tasks: Awaited<ReturnType<typeof getOperationalWorkspace>>["tasks"];
  onDecision: (taskId: string, decision: "approve" | "reject") => Promise<void>;
}) {
  const [workingTaskId, setWorkingTaskId] = useState<string | null>(null);
  const decide = async (taskId: string, decision: "approve" | "reject") => {
    setWorkingTaskId(taskId);
    await onDecision(taskId, decision);
    setWorkingTaskId(null);
  };
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Manager"
        title="Review queue"
        description="Review employee-submitted evidence, then submit approved work to the Tenant Admin for final delivery approval."
      />
      <Card>
        <CardContent className="pt-[30px]">
          {tasks.length ? (
            <ul className="flex flex-col divide-y">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
                >
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {task.assignee} submitted this task for review. Due {task.dueDate}.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      aria-label={`Submit ${task.title} for tenant approval`}
                      disabled={workingTaskId === task.id}
                      onClick={() => void decide(task.id, "approve")}
                    >
                      Submit for tenant approval
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Request changes for ${task.title}`}
                      disabled={workingTaskId === task.id}
                      onClick={() => void decide(task.id, "reject")}
                    >
                      Request changes
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No submitted task reviews"
              description="New employee submissions will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QueuePage({
  title,
  description,
  items,
  readOnly = false,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; title: string; detail: string }>;
  readOnly?: boolean;
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
                {!readOnly ? <div className="flex gap-2">
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
                </div> : null}
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
  tasks,
}: {
  section: "notifications" | "profile";
  tasks: Awaited<ReturnType<typeof getOperationalWorkspace>>["tasks"];
}) {
  const profile = section === "profile";
  const [updatesReviewed, setUpdatesReviewed] = useState(false);
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
              : tasks.length
                ? `${tasks.length} employee task review${tasks.length === 1 ? "" : "s"} ${tasks.length === 1 ? "needs" : "need"} your attention`
                : "No employee task reviews are waiting"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile
              ? "Manager · GST Review and Delivery work groups"
              : tasks.length
                ? "An employee submitted assigned work for your review. Approving marks it done; requesting changes returns it to the employee."
                : "New employee task submissions will appear here."}
          </p>
          {!profile && tasks.length ? (
            <Link
              href="/manager/reviews"
              className="mt-5 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open review queue
            </Link>
          ) : null}
          {!profile ? (
            updatesReviewed ? (
              <p className="mt-5 text-sm text-success" role="status">
                Updates marked as reviewed for this mock session.
              </p>
            ) : (
              <Button className="mt-5" onClick={() => setUpdatesReviewed(true)}>
                <Bell data-icon="inline-start" />
                Mark updates reviewed
              </Button>
            )
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
