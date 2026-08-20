"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  listEmployeeTasks,
  listWorkLogs,
  pauseEmployeeTask,
  resumeEmployeeTask,
  startEmployeeTask,
  submitEmployeeTaskForReview,
} from "@/features/operations/api/operations-api";
import { TaskBoard } from "@/components/operations/task-board";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { Workspace } from "@/types/domain";
import type { OperationalTask } from "@/types/operations";

const statusLabel = {
  "to-do": "To do",
  "in-progress": "In progress",
  review: "Review",
  rejected: "Rejected",
  done: "Done",
} as const;

export function taskStatus(task: OperationalTask) {
  return task.status === "done"
    ? "complete"
    : task.status === "rejected"
      ? "blocked"
    : task.blocked
      ? "blocked"
      : task.status === "review"
        ? "pending"
        : task.sla;
}

export function TasksPage({
  workspace,
  canUpdate = false,
}: {
  workspace: Workspace;
  canUpdate?: boolean;
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OperationalTask["status"] | "">("");
  const [priority, setPriority] = useState<OperationalTask["priority"] | "">(
    "",
  );
  const [selected, setSelected] = useState<OperationalTask | null>(null);
  const [overrides, setOverrides] = useState<Record<string, OperationalTask>>(
    {},
  );
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);
  const [reviewSubmission, setReviewSubmission] =
    useState<OperationalTask | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const tasksQuery = useQuery({
    queryKey: ["operational-tasks", workspace],
    queryFn: async () => {
      if (workspace === "employee") return listEmployeeTasks();
      return [];
    },
    refetchInterval: workspace === "employee" ? 30000 : false,
    refetchOnWindowFocus: false,
  });
  const logsQuery = useQuery({
    queryKey: ["operational-work-logs", workspace],
    queryFn: () => listWorkLogs(workspace),
    enabled: workspace === "employee",
  });
  const tasks = useMemo(() => {
    const items = (tasksQuery.data ?? []).map(
      (task) => overrides[task.id] ?? task,
    );
    return items.filter(
      (task) =>
        (!query || task.title.toLowerCase().includes(query.toLowerCase())) &&
        (!status || task.status === status) &&
        (!priority || task.priority === priority),
    );
  }, [overrides, priority, query, status, tasksQuery.data]);
  const requestedTaskId = searchParams.get("task");
  useEffect(() => {
    if (!requestedTaskId || requestedTaskId === openedTaskId) return;
    const requestedTask = tasks.find((task) => task.id === requestedTaskId);
    if (!requestedTask) return;
    setSelected(requestedTask);
    setOpenedTaskId(requestedTaskId);
  }, [openedTaskId, requestedTaskId, tasks]);
  const syncTask = (next: OperationalTask) => {
    setOverrides((current) => ({ ...current, [next.id]: next }));
    setSelected((current) => (current?.id === next.id ? next : current));
  };
  const updateTask = (next: OperationalTask) => {
    syncTask(next);
    toast.success("Task change saved.");
  };
  const refreshTaskWorkflow = () => {
    void queryClient.invalidateQueries({ queryKey: ["operational-tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["manager-workspace"] });
  };
  const handleEmployeeStatusChange = async (
    task: OperationalTask,
    nextStatus: OperationalTask["status"],
  ) => {
    if (task.status === "in-progress" && nextStatus === "review") {
      setReviewSubmission(task);
      return;
    }
    if (
      nextStatus === "in-progress" &&
      (task.status === "to-do" || task.status === "rejected")
    ) {
      try {
        syncTask(
          task.timer?.status === "paused"
            ? await resumeEmployeeTask(task.id)
            : await startEmployeeTask(task.id),
        );
        refreshTaskWorkflow();
        toast.success("Task started. The active-task timer is now running.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Task status could not change.",
        );
      }
      return;
    }
    toast.error(
      "Employees can only start assigned work, submit it for review, or resume a rejected task.",
    );
  };
  const pauseTask = async (task: OperationalTask) => {
    try {
      syncTask(await pauseEmployeeTask(task.id));
      refreshTaskWorkflow();
      toast.success("Task paused. Worked time was saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task could not be paused.");
    }
  };
  const resumeTask = async (task: OperationalTask) => {
    try {
      syncTask(await resumeEmployeeTask(task.id));
      refreshTaskWorkflow();
      toast.success("Task resumed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task could not be resumed.");
    }
  };
  const submitForReview = async () => {
    if (!reviewSubmission) return;
    setIsSubmittingReview(true);
    try {
      syncTask(await submitEmployeeTaskForReview(reviewSubmission.id, reviewComment));
      refreshTaskWorkflow();
      setReviewSubmission(null);
      setReviewComment("");
      toast.success("Task submitted to the assigned manager for review.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Task could not be submitted.",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };
  const columns: ColumnDef<OperationalTask, unknown>[] = [
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => (
        <button
          className="text-left font-medium hover:text-primary"
          onClick={() => setSelected(row.original)}
        >
          {row.original.title}
        </button>
      ),
    },
    { accessorKey: "client", header: "Client" },
    { accessorKey: "assignee", header: "Assignee" },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <PriorityBadge
          priority={
            (row.original.priority[0].toUpperCase() +
              row.original.priority.slice(1)) as "High" | "Medium" | "Low"
          }
        />
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={taskStatus(row.original)} />,
    },
    { accessorKey: "dueDate", header: "Due" },
  ];
  if (tasksQuery.isPending)
    return <LoadingState label="Loading task delivery workflow" rows={5} />;
  if (tasksQuery.isError)
    return (
      <ErrorState
        title="Tasks could not load"
        onRetry={() => {
          void tasksQuery.refetch();
          if (workspace === "employee") void logsQuery.refetch();
        }}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Delivery"
        title="Tasks"
        description="Start assigned work, track time, and submit finished tasks for review."
      />
      {workspace === "employee" ? <ActiveTaskTimer tasks={tasks} /> : null}
      <FilterToolbar
        search={{
          value: query,
          onChange: setQuery,
          label: "Search tasks",
          placeholder: "Search task, client, engagement, or assignee",
        }}
        activeFilterCount={[status, priority].filter(Boolean).length}
        onClear={() => {
          setQuery("");
          setStatus("");
          setPriority("");
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <Select
            aria-label="Filter by task status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OperationalTask["status"] | "")
            }
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Priority
          <Select
            aria-label="Filter by task priority"
            value={priority}
            onChange={(event) =>
              setPriority(
                event.target.value as OperationalTask["priority"] | "",
              )
            }
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </label>
      </FilterToolbar>
      {!tasks.length ? (
        <EmptyState
          title={
            query || status || priority
              ? "No tasks match these filters"
              : "No tasks are assigned"
          }
          description="Clear filters or wait for authorised work to be assigned."
        />
      ) : (
        <ResponsiveTabs
          label="Task view"
          value={view}
          onValueChange={(value) => setView(value as "board" | "list")}
          tabs={[
            { value: "board", label: "Board" },
            { value: "list", label: "List" },
          ]}
        >
          {view === "board" ? (
            <>
              <TaskBoard
                tasks={tasks}
                onOpen={setSelected}
                onPause={workspace === "employee" ? pauseTask : undefined}
                onResume={workspace === "employee" ? resumeTask : undefined}
                onStatusChange={(id, nextStatus) => {
                  const task = tasks.find((item) => item.id === id);
                  if (!task || !canUpdate) return;
                  if (workspace === "employee") {
                    void handleEmployeeStatusChange(task, nextStatus);
                    return;
                  }
                  updateTask({ ...task, status: nextStatus });
                }}
              />
              <Card className="lg:hidden">
                <CardContent>
                  <TaskMobileList tasks={tasks} onOpen={setSelected} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-0">
                <div className="hidden md:block">
                  <DataTable
                    caption="Tasks in active scope"
                    columns={columns}
                    data={tasks}
                    emptyTitle="No tasks"
                    emptyDescription="No task records are available."
                  />
                </div>
                <div className="md:hidden">
                  <TaskMobileList tasks={tasks} onOpen={setSelected} />
                </div>
              </CardContent>
            </Card>
          )}
        </ResponsiveTabs>
      )}
      <TaskDetailsDrawer
        task={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        workLogs={logsQuery.data ?? []}
        canUpdate={canUpdate}
        canChangeStatus={workspace !== "employee" && canUpdate}
        canManageAssignment={workspace !== "employee" && canUpdate}
        onUpdate={updateTask}
      />
      <ConfirmationDialog
        open={Boolean(reviewSubmission)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewSubmission(null);
            setReviewComment("");
          }
        }}
        title="Submit task for review"
        description="Submitting this task for review locks status changes until your assigned manager approves or rejects the submission."
        confirmLabel="Submit for review"
        isConfirming={isSubmittingReview}
        onConfirm={() => void submitForReview()}
      >
        <p className="text-sm text-muted-foreground">
          Assigned manager: {reviewSubmission?.manager}
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
          Task comment
          <textarea
            className="min-h-24 rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            maxLength={2000}
            placeholder="Write what you completed before submitting."
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
          />
        </label>
      </ConfirmationDialog>
    </div>
  );
}

export function calculateTaskBillingPreview(
  grossAmount: number,
  discountType: "" | "percentage" | "fixed",
  discountValue: string,
) {
  const gross = roundMoney(grossAmount);
  const value = Number(discountValue);
  if (!discountType || !Number.isFinite(value) || value <= 0) {
    return { grossAmount: gross, discountAmount: 0, effectiveAmount: gross };
  }
  const rawDiscount = discountType === "percentage" ? gross * (value / 100) : value;
  const discountAmount = Math.min(gross, roundMoney(rawDiscount));
  return {
    grossAmount: gross,
    discountAmount,
    effectiveAmount: roundMoney(gross - discountAmount),
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function ActiveTaskTimer({ tasks }: { tasks: OperationalTask[] }) {
  const [now, setNow] = useState(() => Date.now());
  const activeTasks = tasks.filter(
    (task) => task.status === "in-progress" && task.timer,
  );

  useEffect(() => {
    if (!activeTasks.some((task) => task.timer?.status === "active")) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTasks]);

  if (!activeTasks.length) return null;
  return (
    <Card aria-label="Active task timer">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="font-medium">Active task timer</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Time is saved as you work on the task.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTasks.map((task) => (
            <p key={task.id} className="text-sm font-medium">
              {task.title}: {formatElapsed(taskWorkedMilliseconds(task, now))}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function taskWorkedMilliseconds(task: OperationalTask, now: number): number {
  const timer = task.timer;
  if (!timer) return 0;
  let seconds = timer.workedSeconds;
  if (timer.status === "active") {
    seconds += Math.max(0, Math.floor((now - new Date(timer.serverTime).getTime()) / 1000));
  }
  return seconds * 1000;
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function TaskMobileList({
  tasks,
  onOpen,
}: {
  tasks: OperationalTask[];
  onOpen: (task: OperationalTask) => void;
}) {
  return (
    <>
      {tasks.map((task) => (
        <MobileEntityCard
          key={task.id}
          title={task.title}
          identifier={task.id}
          priority={
            <PriorityBadge
              priority={
                (task.priority[0].toUpperCase() + task.priority.slice(1)) as
                  | "High"
                  | "Medium"
                  | "Low"
              }
            />
          }
          status={<StatusBadge status={taskStatus(task)} />}
          metadata={
            <>
              <div>
                <dt className="text-muted-foreground">Client</dt>
                <dd>{task.client}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due</dt>
                <dd>{task.dueDate}</dd>
              </div>
            </>
          }
          primaryAction={
            <Button size="sm" variant="outline" onClick={() => onOpen(task)}>
              Open task
            </Button>
          }
        />
      ))}
    </>
  );
}
