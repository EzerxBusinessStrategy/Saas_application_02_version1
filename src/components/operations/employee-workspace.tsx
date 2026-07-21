"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, FileText } from "lucide-react";
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

export function EmployeeWorkspace({
  section = "day",
}: {
  section?:
    | "day"
    | "work-logs"
    | "timesheet"
    | "calendar"
    | "documents"
    | "notifications"
    | "profile";
}) {
  const query = useQuery({
    queryKey: ["employee-workspace"],
    queryFn: () => getOperationalWorkspace("employee"),
  });
  if (query.isPending)
    return <LoadingState label="Loading employee workspace" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Employee workspace could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const data = query.data;
  if (section === "work-logs" || section === "timesheet")
    return (
      <WorkLogPage
        title={section === "work-logs" ? "Daily work logs" : "Timesheet"}
        logs={data.workLogs}
      />
    );
  if (section === "calendar")
    return <CalendarPage milestones={data.milestones} />;
  if (section === "documents")
    return (
      <DocumentPage
        documents={data.documents.filter(
          (document) => document.visibility === "client",
        )}
      />
    );
  if (section === "notifications" || section === "profile")
    return <EmployeeInfo section={section} />;
  const today = data.tasks.find((task) => task.status === "in-progress");
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="My day"
        description="Focus on authorised work, record evidence, and keep delivery quality visible."
        actions={
          <Button variant="outline">
            <Clock3 data-icon="inline-start" />
            Add work log
          </Button>
        }
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4"
        aria-label="My day metrics"
      >
        {[
          {
            label: "Due today",
            value: String(
              data.tasks.filter((task) => task.dueDate === "2026-07-21").length,
            ),
          },
          {
            label: "In progress",
            value: String(
              data.tasks.filter((task) => task.status === "in-progress").length,
            ),
          },
          { label: "Time logged today", value: "2h 30m" },
          {
            label: "Work-log status",
            value: data.workLogs.some((log) => log.status === "draft")
              ? "Draft"
              : "Submitted",
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
        <Card>
          <CardHeader>
            <CardTitle>Current task</CardTitle>
            <CardDescription>
              Pause or complete only when the delivery evidence is ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {today ? (
              <>
                <p className="font-medium">{today.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {today.client} · due today
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button>Resume task</Button>
                  <Button variant="outline">Pause</Button>
                  <Button variant="outline">Complete checklist</Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {today.checklist.filter((item) => item.complete).length}/
                  {today.checklist.length} checklist items complete ·{" "}
                  {today.sla.replaceAll("-", " ")}
                </p>
              </>
            ) : (
              <EmptyState
                title="No current task"
                description="Choose an assigned task when you are ready to begin."
              />
            )}
          </CardContent>
        </Card>
        <ProfessionalProgress data={data} />
      </section>
    </div>
  );
}

function WorkLogPage({
  title,
  logs,
}: {
  title: string;
  logs: Array<{
    id: string;
    date: string;
    durationMinutes: number;
    description: string;
    status: "draft" | "submitted" | "reviewed" | "rejected";
    reviewerComment: string | null;
  }>;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title={title}
        description="Daily entries are saved as provisional mock data until the authorised work-log API is available."
      />
      <Card>
        <CardContent className="pt-[30px]">
          <ul className="flex flex-col divide-y">
            {logs.map((log) => (
              <li key={log.id} className="py-4 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {log.date} · {Math.floor(log.durationMinutes / 60)}h{" "}
                      {log.durationMinutes % 60}m
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {log.description}
                    </p>
                    {log.reviewerComment ? (
                      <p className="mt-1 text-sm text-warning">
                        Review note: {log.reviewerComment}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge
                    status={
                      log.status === "reviewed"
                        ? "complete"
                        : log.status === "rejected"
                          ? "at-risk"
                          : "pending"
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            Missing-entry checklist: no required entries are missing today.
            Approved leave and holidays are excluded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
function CalendarPage({
  milestones,
}: {
  milestones: Array<{
    id: string;
    label: string;
    date: string;
    complete: boolean;
  }>;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="Calendar"
        description="Delivery milestones and approved non-working time are shown in your local working schedule."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-[18px] text-primary" />
            Upcoming milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex items-center justify-between gap-3 py-4 first:pt-0"
              >
                <div>
                  <p className="font-medium">{milestone.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {milestone.date}
                  </p>
                </div>
                <StatusBadge
                  status={milestone.complete ? "complete" : "pending"}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
function DocumentPage({
  documents,
}: {
  documents: Array<{
    id: string;
    name: string;
    client: string;
    updatedOn: string;
  }>;
}) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="Documents"
        description="Only documents authorised for your assigned work are listed."
      />
      <Card>
        <CardContent className="pt-[30px]">
          <ul className="flex flex-col divide-y">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-3 py-4 first:pt-0"
              >
                <FileText className="size-4 text-primary" />
                <div>
                  <p className="font-medium">{document.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.client} · updated {document.updatedOn}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
function ProfessionalProgress({
  data,
}: {
  data: Awaited<ReturnType<typeof getOperationalWorkspace>>;
}) {
  if (!data.preferences.enabled) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal progress</CardTitle>
        <CardDescription>
          Private, optional progress visibility. It never rewards overtime or
          resets for approved leave.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-5">
          {data.goalProgress.map((progress) => {
            const goal = data.goals.find((item) => item.id === progress.goalId);
            const value = Math.round(
              (progress.current / progress.target) * 100,
            );
            return (
              <li key={progress.goalId}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">{goal?.label}</span>
                  <span>
                    {progress.current}/{progress.target} · {value}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-control)] bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-sm text-muted-foreground">
          {data.streak.label}: {data.streak.currentDays} scheduled days.{" "}
          {data.streak.protectedDays} approved leave or holiday days are
          protected.
        </p>
        <div className="mt-5 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" />
          {data.achievements.find((item) => item.unlocked)?.title}:{" "}
          {data.achievements.find((item) => item.unlocked)?.description}
        </div>
      </CardContent>
    </Card>
  );
}
function EmployeeInfo({ section }: { section: "notifications" | "profile" }) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title={section === "profile" ? "Profile" : "Notifications"}
        description={
          section === "profile"
            ? "Your work identity and private preferences."
            : "Delivery updates related to your assigned tasks."
        }
      />
      <Card>
        <CardContent className="pt-[30px]">
          <p className="font-medium">
            {section === "profile"
              ? "Riley Shah"
              : "One review comment needs a resubmission"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {section === "profile"
              ? "Employee · GST Review work group"
              : "Link the source document to the rejected work log before resubmitting."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
