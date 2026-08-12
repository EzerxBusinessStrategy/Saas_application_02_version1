"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock3, FileText } from "lucide-react";
import { getEmployeeDashboard, type EmployeeDashboard } from "@/features/employee/api/employee-dashboard-api";
import {
  createEmployeeManagerTask,
  decideEmployeeManagerReview,
  getEmployeeManagerTaskOptions,
  listEmployeeManagerClients,
  listEmployeeManagerReviews,
} from "@/features/employee/api/employee-manager-api";
import { getEmployeeNotifications } from "@/features/employee/api/employee-notifications-api";
import { getEmployeeProfile } from "@/features/employee/api/employee-profile-api";
import { getGamificationWorkspace, listEmployeeTasks } from "@/features/operations/api/operations-api";
import { TaskBoard } from "@/components/operations/task-board";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import {
  AchievementCatalogue,
  DailyProgress,
  EmployeePreferences,
  EmployeeRecognition,
  WorkLogConsistency,
} from "@/components/operations/gamification-workflows";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { BoxBuildLoader } from "@/components/shared/box-build-loader";
import { LoadingState } from "@/components/shared/loading-state";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OperationalTask, WorkLog } from "@/types/operations";

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
    | "profile"
    | "clients"
    | "assign-task"
    | "task-reviews"
    | "achievements"
    | "recognition"
    | "preferences";
}) {
  if (section === "day") return <EmployeeDayDashboard />;
  if (section === "achievements") return <AchievementCatalogue />;
  if (section === "recognition") return <EmployeeRecognition />;
  if (section === "preferences") return <EmployeePreferences />;
  if (section === "calendar") return <EmployeeCalendarPage />;
  if (section === "clients") return <EmployeeManagerClientsPage />;
  if (section === "assign-task") return <EmployeeManagerAssignTaskPage />;
  if (section === "task-reviews") return <EmployeeManagerTaskReviewsPage />;
  return (
    <EmployeeLegacyWorkspace
      section={
        section as Parameters<typeof EmployeeLegacyWorkspace>[0]["section"]
      }
    />
  );
}

function EmployeeLegacyWorkspace({
  section,
}: {
  section:
    | "work-logs"
    | "timesheet"
    | "calendar"
    | "documents"
    | "notifications"
    | "profile";
}) {

  const query = useQuery({
    queryKey: ["gamification", "employee"],
    queryFn: () => getGamificationWorkspace("employee"),
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
      <div className="flex flex-col gap-[30px]">
        <WorkLogPage
          title={section === "work-logs" ? "Daily work logs" : "Timesheet"}
          logs={data.workLogs}
        />
        <WorkLogConsistency data={data} />
      </div>
    );
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
          <Link
            href="/employee/work-logs"
            className={buttonVariants({ variant: "outline" })}
          >
            <Clock3 data-icon="inline-start" />
            Add work log
          </Link>
        }
      />
      <DailyProgress data={data} />
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
                <Link
                  href="/employee/tasks"
                  className={`mt-5 ${buttonVariants()}`}
                >
                  Open task
                </Link>
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

function EmployeeDayDashboard() {
  const query = useQuery({
    queryKey: ["employee-dashboard"],
    queryFn: getEmployeeDashboard,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  if (query.isPending) return <LoadingState label="Loading my day" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Employee profile could not load"
        onRetry={() => void query.refetch()}
      />
    );

  const data = query.data;
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-primary">Employee</p>
        <h1 className="mt-1 text-[28px] leading-[34px] font-bold tracking-tight">
          My day
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {format(new Date(data.today), "EEEE, d MMMM")}
        </p>
        {data.employeeName ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Good {dayPart()}, {data.employeeName}
          </p>
        ) : null}
        <p className="mt-4 text-sm font-medium text-foreground">
          {data.summary.dueToday} due today{" "}
          <span className="text-muted-foreground">·</span>{" "}
          {data.summary.inProgress} in progress{" "}
          <span className="text-muted-foreground">·</span>{" "}
          {data.summary.needsChanges} needs changes
        </p>
      </header>

      <section aria-labelledby="my-assigned-work">
        <h2
          id="my-assigned-work"
          className="mb-3 text-sm font-semibold uppercase tracking-normal text-muted-foreground"
        >
          My assigned work
        </h2>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {data.tasks.length ? (
              <ul className="divide-y">
                {data.tasks.map((task) => (
                  <EmployeeTaskRow key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No assigned work"
                  description="Tasks assigned by your tenant or manager will appear here."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="today-work-log">
        <h2
          id="today-work-log"
          className="mb-3 text-sm font-semibold uppercase tracking-normal text-muted-foreground"
        >
          Today&apos;s work log
        </h2>
        <WorkLogCard workLog={data.workLog} />
      </section>
    </div>
  );
}

function EmployeeTaskRow({
  task,
}: {
  task: EmployeeDashboard["tasks"][number];
}) {
  return (
    <li className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {task.needsChanges ? (
          <p className="mb-2 text-sm font-medium text-danger">Needs changes</p>
        ) : null}
        <p className="font-medium text-foreground">{task.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{task.clientName}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {task.statusLabel} <span aria-hidden="true">·</span>{" "}
          {formatDue(task.plannedDueAt, task.dueToday)}
        </p>
        {task.needsChanges ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {task.latestManagerNote || "Manager requested changes"}
          </p>
        ) : null}
      </div>
      <Link
        href={`/employee/tasks?task=${encodeURIComponent(task.id)}`}
        className={buttonVariants({ size: "sm" })}
      >
        {task.actionLabel}
      </Link>
    </li>
  );
}

function WorkLogCard({
  workLog,
}: {
  workLog: EmployeeDashboard["workLog"];
}) {
  const hasLoggedTime = workLog.loggedMinutes > 0;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">
            {hasLoggedTime
              ? formatMinutes(workLog.loggedMinutes)
              : "No work logged yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {workLog.status === "not_started"
              ? "Not started"
              : workLogStatus(workLog.status)}
          </p>
        </div>
        <Link
          href="/employee/work-logs"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {hasLoggedTime ? "Open work log" : "Add work log"}
        </Link>
      </CardContent>
    </Card>
  );
}

function formatDue(plannedDueAt: string | null, dueToday: boolean): string {
  if (!plannedDueAt) return "No due date";
  if (dueToday) return "Due today";
  return `Due ${format(parseISO(plannedDueAt), "d MMM")}`;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining}m logged`;
  if (!remaining) return `${hours}h logged`;
  return `${hours}h ${remaining}m logged`;
}

function workLogStatus(status: "draft" | "submitted" | "reviewed"): string {
  if (status === "draft") return "Draft";
  if (status === "submitted") return "Submitted";
  return "Reviewed";
}

function dayPart(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
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

function EmployeeCalendarPage() {
  const query = useQuery({
    queryKey: ["employee-calendar-tasks"],
    queryFn: listEmployeeTasks,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  if (query.isPending) return <LoadingState label="Loading calendar" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Calendar could not load"
        onRetry={() => void query.refetch()}
      />
    );

  return <CalendarPage tasks={query.data} workLogs={[]} />;
}

function CalendarPage({
  tasks,
  workLogs,
}: {
  tasks: OperationalTask[];
  workLogs: WorkLog[];
}) {
  const datedTasks = tasks.filter((task) => /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate));
  const [month, setMonth] = useState(() =>
    startOfMonth(parseISO(datedTasks[0]?.dueDate ?? format(new Date(), "yyyy-MM-dd"))),
  );
  const [selectedDate, setSelectedDate] = useState(
    datedTasks[0]?.dueDate ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(
    null,
  );
  const milestones = datedTasks.map((task) => ({
    id: task.id,
    label: task.title,
    date: task.dueDate,
    complete: task.status === "done",
  }));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
  const tasksFor = (day: Date) =>
    datedTasks
      .filter((task) => task.dueDate === format(day, "yyyy-MM-dd"))
      .map((task) => ({
        id: task.id,
        label: task.title,
        complete: task.status === "done",
      }));
  const selectedTasks = datedTasks.filter((task) => task.dueDate === selectedDate);
  const changeMonth = (nextMonth: Date) => {
    setMonth(nextMonth);
    setSelectedDate(
      datedTasks.find((task) => isSameMonth(parseISO(task.dueDate), nextMonth))
        ?.dueDate ?? format(startOfMonth(nextMonth), "yyyy-MM-dd"),
    );
  };
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Employee"
        title="Calendar"
        description="Review your assigned tasks by deadline, then open the exact task when you are ready to work."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-[18px] text-primary" />
              Delivery calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Previous month"
                onClick={() => changeMonth(subMonths(month, 1))}
              >
                Previous
              </Button>
              <p
                className="min-w-28 text-center text-sm font-medium"
                aria-live="polite"
              >
                {format(month, "MMMM yyyy")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Next month"
                onClick={() => changeMonth(addMonths(month, 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto sm:block">
            <table
              aria-label={`Delivery calendar for ${format(month, "MMMM yyyy")}`}
              className="w-full table-fixed border-collapse text-left text-sm"
            >
              <thead>
                <tr className="border-y text-muted-foreground">
                  {eachDayOfInterval({
                    start: startOfWeek(new Date(2026, 0, 4)),
                    end: endOfWeek(new Date(2026, 0, 4)),
                  }).map((day) => (
                    <th
                      key={day.toISOString()}
                      className="p-3 font-medium"
                      scope="col"
                    >
                      {format(day, "EEE")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]?.toISOString()}>
                    {week.map((day) => {
                      const entries = tasksFor(day);
                      return (
                        <td
                          key={day.toISOString()}
                          className="h-28 border-b border-r p-2 align-top last:border-r-0"
                        >
                          <button
                            type="button"
                            aria-label={`${format(day, "EEEE, MMMM d, yyyy")}${entries.length ? `, ${entries.length} assigned task${entries.length === 1 ? "" : "s"}` : ", no assigned tasks"}`}
                            aria-pressed={isSameDay(
                              day,
                              parseISO(selectedDate),
                            )}
                            className={
                              "rounded-[var(--radius-control)] px-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring " +
                              (isSameDay(day, parseISO(selectedDate))
                                ? "bg-secondary"
                                : "")
                            }
                            onClick={() =>
                              setSelectedDate(format(day, "yyyy-MM-dd"))
                            }
                          >
                            <time
                              dateTime={format(day, "yyyy-MM-dd")}
                              className={
                                isSameMonth(day, month)
                                  ? "font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {format(day, "d")}
                            </time>
                            {entries.length ? (
                              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {entries.length}
                              </span>
                            ) : null}
                          </button>
                          <div className="mt-2 flex flex-col gap-1">
                            {entries.map((milestone) => (
                              <p
                                key={milestone.id}
                                className="line-clamp-2 rounded-[var(--radius-control)] bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                                title={`${milestone.label} — ${milestone.complete ? "complete" : "pending"}`}
                              >
                                {milestone.label}
                              </p>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul
            className="flex flex-col divide-y sm:hidden"
            aria-label="Assigned task dates"
          >
            {milestones
              .filter((milestone) =>
                isSameMonth(parseISO(milestone.date), month),
              )
              .map((milestone) => (
                <li
                  key={milestone.id}
                  className="py-4 first:pt-0"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] p-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    aria-pressed={selectedDate === milestone.date}
                    onClick={() => setSelectedDate(milestone.date)}
                  >
                    <span>
                      <span className="block font-medium">
                        {milestone.label}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {format(parseISO(milestone.date), "EEE, MMM d, yyyy")}
                      </span>
                    </span>
                    <StatusBadge
                      status={milestone.complete ? "complete" : "pending"}
                    />
                  </button>
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Tasks due {format(parseISO(selectedDate), "EEEE, MMMM d")}
          </CardTitle>
          <CardDescription>
            Assignment, deadline, and delivery context for the selected date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedTasks.length ? (
            <ul className="flex flex-col divide-y">
              {selectedTasks.map((task) => (
                <li key={task.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {task.client} · {task.engagement} · {task.workGroup}
                      </p>
                    </div>
                    <StatusBadge status={task.sla} />
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Assigned by</dt>
                      <dd className="mt-1 font-medium">{task.manager}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Deadline</dt>
                      <dd className="mt-1 font-medium">{task.dueDate}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Task status</dt>
                      <dd className="mt-1 font-medium">
                        {task.status.replaceAll("-", " ")}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/employee/tasks?task=${task.id}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Open task
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTask(task)}
                    >
                      View details
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No tasks due on this date"
              description="Select another day with an assigned-task count, or wait for a manager to assign work."
            />
          )}
        </CardContent>
      </Card>
      <TaskDetailsDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        workLogs={workLogs}
        canUpdate={false}
        onUpdate={() => undefined}
      />
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

function EmployeeManagerClientsPage() {
  const query = useQuery({ queryKey: ["employee-manager-clients"], queryFn: listEmployeeManagerClients });
  if (query.isPending) return <LoadingState label="Loading clients" rows={4} />;
  if (query.isError) return <ErrorState title="Clients could not load" onRetry={() => void query.refetch()} />;
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader eyebrow="Manager" title="Clients" description="Tenant clients available for task assignment." />
      <Card>
        <CardContent className="pt-[30px]">
          {query.data.length ? (
            <ul className="divide-y">
              {query.data.map((client) => (
                <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{client.status} · {client.openTasks} open tasks</p>
                  </div>
                  <Link href={`/employee/assign-task?client=${client.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Assign task</Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No clients" description="Active tenant clients will appear here." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeManagerAssignTaskPage() {
  const queryClient = useQueryClient();
  const optionsQuery = useQuery({ queryKey: ["employee-manager-task-options"], queryFn: getEmployeeManagerTaskOptions });
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: createEmployeeManagerTask,
    onSuccess: async () => {
      setMessage("Task assigned.");
      setTitle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["employee-manager-task-options"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Task could not be assigned."),
  });
  const options = optionsQuery.data;
  const selectedService = serviceId || options?.services[0]?.id || "";
  const selectedClient = clientId || options?.clients[0]?.id || "";
  const selectedEmployee = employeeId || options?.employees[0]?.id || "";
  const assign = () => {
    if (!options || !selectedClient || !selectedService || !selectedEmployee || !title.trim()) return;
    const country = options.countries[0];
    const rate = options.rateItems.find((item) => item.serviceId === selectedService && (!item.clientId || item.clientId === selectedClient));
    if (!country) {
      setMessage("No active financial year is configured for this tenant.");
      return;
    }
    mutation.mutate({
      clientId: selectedClient,
      serviceId: selectedService,
      countryCode: country.countryCode,
      title,
      description,
      priority,
      plannedDueAt: dueDate ? new Date(`${dueDate}T18:00:00`).toISOString() : undefined,
      employeeIds: [selectedEmployee],
      billing: rate
        ? { rateSource: "existing", rateCardItemId: rate.id, quantity: 1, discountValue: 0 }
        : {
            rateSource: "new",
            taskType: title,
            unitType: "per_task",
            rateAmount: 0,
            currencyCode: "INR",
            effectiveFrom: new Date().toISOString().slice(0, 10),
            saveToRateCard: false,
            oneTimeReason: "Manager V1 task assignment",
            quantity: 1,
            discountValue: 0,
          },
    });
  };
  if (optionsQuery.isPending) return <LoadingState label="Loading task form" rows={4} />;
  if (optionsQuery.isError || !options) return <ErrorState title="Task form could not load" onRetry={() => void optionsQuery.refetch()} />;
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader eyebrow="Manager" title="Assign Task" description="Create a task for an employee in this tenant." />
      <Card>
        <CardContent className="grid gap-4 pt-[30px] sm:grid-cols-2">
          <ManagerField label="Client"><select className={managerInputClass} value={selectedClient} onChange={(event) => setClientId(event.target.value)}>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></ManagerField>
          <ManagerField label="Service"><select className={managerInputClass} value={selectedService} onChange={(event) => setServiceId(event.target.value)}>{options.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></ManagerField>
          <ManagerField label="Task title"><input className={managerInputClass} value={title} onChange={(event) => setTitle(event.target.value)} /></ManagerField>
          <ManagerField label="Assign employee"><select className={managerInputClass} value={selectedEmployee} onChange={(event) => setEmployeeId(event.target.value)}>{options.employees.filter((employee) => employee.employmentStatus === "active").map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></ManagerField>
          <ManagerField label="Priority"><select className={managerInputClass} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></ManagerField>
          <ManagerField label="Due date"><input type="date" className={managerInputClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></ManagerField>
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">Description<textarea className={`${managerInputClass} min-h-28`} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
            {message ? <p className="mr-auto text-sm text-muted-foreground">{message}</p> : null}
            <Button disabled={mutation.isPending || !title.trim() || !selectedClient || !selectedService || !selectedEmployee} onClick={assign}>{mutation.isPending ? "Assigning..." : "Assign Task"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeManagerTaskReviewsPage() {
  const queryClient = useQueryClient();
  const [returnTaskId, setReturnTaskId] = useState<string | null>(null);
  const [returnRemarks, setReturnRemarks] = useState("");
  const query = useQuery({ queryKey: ["employee-manager-reviews"], queryFn: listEmployeeManagerReviews });
  const mutation = useMutation({
    mutationFn: ({ taskId, decision, remarks }: { taskId: string; decision: "approve" | "return"; remarks?: string }) => decideEmployeeManagerReview(taskId, decision, remarks),
    onSuccess: async (_result, variables) => {
      toast.success(variables.decision === "approve" ? "Task completed. The invoice queue is ready for the Tenant Admin." : "Changes requested and task returned to the employee.");
      setReturnTaskId(null);
      setReturnRemarks("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee-manager-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["employee-notifications"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The review decision could not be saved."),
  });
  if (query.isPending) return <LoadingState label="Loading task reviews" rows={4} />;
  if (query.isError) return <ErrorState title="Task reviews could not load" onRetry={() => void query.refetch()} />;
  const returnTask = query.data.find((task) => task.id === returnTaskId) ?? null;
  const boardTasks: OperationalTask[] = query.data.map((task) => ({
    id: task.id,
    tenantId: "authenticated",
    clientId: task.id,
    client: task.clientName,
    engagement: "Submitted work",
    workGroup: "Assigned work group",
    managerId: "current",
    manager: "Current manager",
    assigneeId: task.id,
    assignee: task.employeeName,
    title: task.title,
    description: task.taskComment ?? "No submission comment.",
    priority: "medium",
    complexity: "standard",
    status: "review",
    sla: "on-track",
    dueDate: `Submitted ${format(parseISO(task.submittedAt), "d MMM, p")}`,
    checklist: [],
    dependencyIds: [],
    attachmentCount: 0,
    commentCount: 0,
    reviewStatus: "pending",
    approvalStatus: "pending",
    blocked: false,
  }));
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader eyebrow="Manager" title="Task Reviews" description={`${query.data.length} submitted task${query.data.length === 1 ? "" : "s"}. Drag each task to Returned or Done.`} />
      {query.data.length ? (
        <TaskBoard
          tasks={boardTasks}
          onOpen={() => undefined}
          canDragTask={() => !mutation.isPending}
          allowedDropStatuses={["rejected", "done"]}
          onStatusChange={(taskId, status) => {
            if (mutation.isPending) return;
            if (status === "done") {
              mutation.mutate({ taskId, decision: "approve" });
              return;
            }
            if (status === "rejected") {
              setReturnTaskId(taskId);
              setReturnRemarks("");
            }
          }}
        />
      ) : (
        <Card><CardContent className="pt-[30px]"><EmptyState title="No pending reviews" description="Submitted employee tasks will appear here." /></CardContent></Card>
      )}
      <ConfirmationDialog
        open={Boolean(returnTask)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setReturnTaskId(null);
            setReturnRemarks("");
          }
        }}
        title="Return task for changes"
        description="Explain what the employee must change. The task will return to in progress."
        confirmLabel="Return task"
        warning
        isConfirming={mutation.isPending}
        confirmDisabled={!returnRemarks.trim()}
        onConfirm={() => {
          if (returnTask) mutation.mutate({ taskId: returnTask.id, decision: "return", remarks: returnRemarks.trim() });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Changes required
          <textarea className={`${managerInputClass} min-h-24`} value={returnRemarks} onChange={(event) => setReturnRemarks(event.target.value)} placeholder="Describe what must be changed" />
        </label>
      </ConfirmationDialog>
    </div>
  );
}

const managerInputClass = "min-h-11 rounded-[var(--radius-control)] border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ManagerField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium">{label}{children}</label>;
}

function ProfessionalProgress({
  data,
}: {
  data: Awaited<ReturnType<typeof getGamificationWorkspace>>;
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
  const notifications = useQuery({ queryKey: ["employee-notifications", "page"], queryFn: getEmployeeNotifications, enabled: section === "notifications", refetchInterval: 10000 });
  const profile = useQuery({ queryKey: ["employee-profile"], queryFn: getEmployeeProfile, enabled: section === "profile" });

  if (section === "notifications") {
    return (
      <div className="flex flex-col gap-[30px]">
        <PageHeader
          eyebrow="Employee"
          title="Notifications"
          description="Delivery updates related to your assigned tasks."
        />
        <Card>
          <CardContent className="pt-[30px]">
            {notifications.isLoading ? (
              <BoxBuildLoader
                label="Loading notifications"
                className="h-64 min-h-64"
                variant="panel"
              />
            ) : null}
            {notifications.isError ? (
              <p className="text-sm text-danger">
                Notifications could not load.
              </p>
            ) : null}
            {!notifications.isLoading &&
            !notifications.isError &&
            !notifications.data?.items.length ? (
              <EmptyState
                title="No notifications"
                description="New task and document updates will appear here."
              />
            ) : null}
            {notifications.data?.items.length ? (
              <ul className="divide-y">
                {notifications.data.items.map((item) => (
                  <li key={item.id} className="py-4 first:pt-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profile.isLoading) return <LoadingState label="Loading profile" rows={3} />;
  if (profile.isError || !profile.data) return <ErrorState title="Employee profile could not load" onRetry={() => void profile.refetch()} />;
  const data = profile.data;

  return <div className="flex flex-col gap-[30px]"><PageHeader eyebrow="Employee" title="Profile" description="Your work identity." /><Card><CardContent className="pt-[30px]"><p className="font-medium">{data.name}</p><p className="mt-2 text-sm text-muted-foreground">{data.role} - {data.tenantName}</p><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><ProfileDetail label="Email" value={data.email} /><ProfileDetail label="Employee code" value={data.employeeCode} /><ProfileDetail label="Status" value={data.status} /><ProfileDetail label="Department" value={data.department ?? "Not set"} /><ProfileDetail label="Experience" value={data.experienceLevel ?? "Not set"} /><ProfileDetail label="Weekly capacity" value={data.weeklyCapacityHours === null ? "Not set" : `${data.weeklyCapacityHours}h`} /></dl><div className="mt-6"><p className="text-sm font-medium">Work groups</p><p className="mt-2 text-sm text-muted-foreground">{data.workGroups.length ? data.workGroups.join(", ") : "No active work group"}</p></div></CardContent></Card></div>;
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}
