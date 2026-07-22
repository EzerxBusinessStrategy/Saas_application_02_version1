"use client";

import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, FileText } from "lucide-react";
import { getGamificationWorkspace } from "@/features/operations/api/operations-api";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import {
  AchievementCatalogue,
  DailyProgress,
  EmployeePreferences,
  EmployeeRecognition,
  WorkLogConsistency,
} from "@/components/operations/gamification-workflows";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
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
    | "achievements"
    | "recognition"
    | "preferences";
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
  if (section === "achievements") return <AchievementCatalogue />;
  if (section === "recognition") return <EmployeeRecognition />;
  if (section === "preferences") return <EmployeePreferences />;
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
  if (section === "calendar")
    return <CalendarPage tasks={data.tasks} workLogs={data.workLogs} />;
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
  tasks,
  workLogs,
}: {
  tasks: OperationalTask[];
  workLogs: WorkLog[];
}) {
  const [month, setMonth] = useState(() =>
    startOfMonth(parseISO(tasks[0]?.dueDate ?? "2026-07-01")),
  );
  const [selectedDate, setSelectedDate] = useState(
    tasks[0]?.dueDate ?? "2026-07-01",
  );
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(
    null,
  );
  const milestones = tasks.map((task) => ({
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
    tasks
      .filter((task) => task.dueDate === format(day, "yyyy-MM-dd"))
      .map((task) => ({
        id: task.id,
        label: task.title,
        complete: task.status === "done",
      }));
  const selectedTasks = tasks.filter((task) => task.dueDate === selectedDate);
  const changeMonth = (nextMonth: Date) => {
    setMonth(nextMonth);
    setSelectedDate(
      tasks.find((task) => isSameMonth(parseISO(task.dueDate), nextMonth))
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
