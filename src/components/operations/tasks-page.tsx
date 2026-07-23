"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  decideTenantTaskApproval,
  listOperationalTasks,
  listTaskClients,
  listWorkLogs,
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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

function taskStatus(task: OperationalTask) {
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
  canCreate = false,
  canUpdate = false,
}: {
  workspace: Workspace;
  canCreate?: boolean;
  canUpdate?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"board" | "list">(
    workspace === "admin" ? "list" : "board",
  );
  const [tenantApprovalView, setTenantApprovalView] = useState<
    "all" | "awaiting-tenant-approval"
  >("all");
  const selectedClientId = workspace === "admin" ? searchParams.get("clientId") : null;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OperationalTask["status"] | "">("");
  const [priority, setPriority] = useState<OperationalTask["priority"] | "">(
    "",
  );
  const [selected, setSelected] = useState<OperationalTask | null>(null);
  const [createdTasks, setCreatedTasks] = useState<OperationalTask[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OperationalTask>>(
    {},
  );
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);
  const [reviewSubmission, setReviewSubmission] =
    useState<OperationalTask | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const tasksQuery = useQuery({
    queryKey: ["operational-tasks", workspace, selectedClientId, query, status, priority],
    queryFn: () =>
      listOperationalTasks(workspace, {
        query,
        status: status || undefined,
        priority: priority || undefined,
        client: selectedClient?.name,
      }),
    enabled: workspace !== "admin" || Boolean(selectedClientId),
  });
  const clientsQuery = useQuery({
    queryKey: ["task-clients", workspace],
    queryFn: () => listTaskClients(workspace),
    enabled: workspace === "admin",
  });
  const logsQuery = useQuery({
    queryKey: ["operational-work-logs", workspace, selectedClientId],
    queryFn: () => listWorkLogs(workspace),
    enabled: workspace !== "admin" || Boolean(selectedClientId),
  });
  const selectedClient = clientsQuery.data?.find((client) => client.id === selectedClientId);
  const tasks = useMemo(() => {
    const items = [...(tasksQuery.data ?? []), ...createdTasks].map(
      (task) => overrides[task.id] ?? task,
    );
    return items.filter(
      (task) =>
        (!query || task.title.toLowerCase().includes(query.toLowerCase())) &&
        (!status || task.status === status) &&
        (!priority || task.priority === priority),
    );
  }, [createdTasks, overrides, priority, query, status, tasksQuery.data]);
  const visibleTasks =
    workspace === "admin" && tenantApprovalView === "awaiting-tenant-approval"
      ? tasks.filter(
          (task) =>
            task.status === "review" &&
            task.reviewStatus === "approved" &&
            task.approvalStatus === "pending",
        )
      : tasks;
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
    toast.success("Task change saved for this mock session.");
  };
  const refreshTaskWorkflow = () => {
    void queryClient.invalidateQueries({ queryKey: ["operational-tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["manager-workspace"] });
  };
  const handleTenantApproval = async (
    task: OperationalTask,
    decision: "approve" | "return",
  ) => {
    try {
      syncTask(await decideTenantTaskApproval(task.id, decision));
      refreshTaskWorkflow();
      toast.success(
        decision === "approve"
          ? "Tenant approval recorded. The task is complete."
          : "Task returned to the employee for rework.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The tenant approval decision could not be saved.",
      );
    }
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
        syncTask(await startEmployeeTask(task.id));
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
  const submitForReview = async () => {
    if (!reviewSubmission) return;
    setIsSubmittingReview(true);
    try {
      syncTask(await submitEmployeeTaskForReview(reviewSubmission.id));
      refreshTaskWorkflow();
      setReviewSubmission(null);
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
  if (clientsQuery.isPending || ((workspace !== "admin" || selectedClientId) && (tasksQuery.isPending || logsQuery.isPending)))
    return <LoadingState label="Loading task delivery workflow" rows={5} />;
  if (tasksQuery.isError || logsQuery.isError)
    return (
      <ErrorState
        title="Tasks could not load"
        onRetry={() => {
          void tasksQuery.refetch();
          void logsQuery.refetch();
        }}
      />
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Delivery"
        title={workspace === "admin" ? "Client tasks" : "Tasks"}
        description={workspace === "admin" ? "Select a client to plan, assign, review and manage all work within their active scope." : "Plan, assign, complete, review, and approve client work within the active scope."}
        actions={
          canCreate && (workspace !== "admin" || selectedClient) ? (
            <CreateTaskAction
              onCreate={(title) => {
                const task: OperationalTask = {
                  id: `TASK-MOCK-${createdTasks.length + 1}`,
                  tenantId: "acme",
                  clientId: selectedClient?.id ?? "northstar",
                  client: selectedClient?.name ?? "Northstar Labs",
                  engagement: selectedClient?.engagement ?? "GST Filing",
                  workGroup: "GST Review",
                  managerId: "mgr-avery",
                  manager: "Avery Patel",
                  assigneeId: "emp-riley",
                  assignee: "Riley Shah",
                  title,
                  description: "New task created in the current mock session.",
                  priority: "medium",
                  complexity: "standard",
                  status: "to-do",
                  sla: "on-track",
                  dueDate: "2026-07-25",
                  checklist: [],
                  dependencyIds: [],
                  attachmentCount: 0,
                  commentCount: 0,
                  reviewStatus: "not-required",
                  approvalStatus: "not-required",
                  blocked: false,
                };
                setCreatedTasks((current) => [task, ...current]);
              }}
            />
          ) : undefined
        }
      />
      {workspace === "admin" ? (
        <Card>
          <CardContent className="grid gap-3 py-5 md:grid-cols-[minmax(0,360px)_1fr] md:items-end">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Select client
              <Select
                aria-label="Select client"
                value={selectedClientId ?? ""}
                onChange={(event) => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (event.target.value) params.set("clientId", event.target.value);
                  else params.delete("clientId");
                  params.delete("task");
                  router.replace(`${pathname}?${params.toString()}`);
                }}
              >
                <option value="">Search and select a client</option>
                {(clientsQuery.data ?? []).map((client) => <option key={client.id} value={client.id}>{client.name} · Manager: {client.manager}</option>)}
              </Select>
            </label>
            {selectedClient ? <p className="text-sm text-muted-foreground">{selectedClient.name} · {selectedClient.engagement} · Manager: {selectedClient.manager}</p> : null}
          </CardContent>
        </Card>
      ) : null}
      {workspace === "admin" && !selectedClientId ? (
        <EmptyState title="Select a client to manage tasks" description="Choose a client to view their current work, assignments, submissions, review queue and task history." />
      ) : <>
      {workspace === "employee" ? <ActiveTaskTimer tasks={tasks} /> : null}
      {workspace === "admin" ? (
        <ResponsiveTabs
          label="Client task queue"
          value={tenantApprovalView}
          onValueChange={(value) =>
            setTenantApprovalView(value as "all" | "awaiting-tenant-approval")
          }
          tabs={[
            { value: "all", label: "All client tasks" },
            {
              value: "awaiting-tenant-approval",
              label: `Awaiting tenant approval (${tasks.filter((task) => task.status === "review" && task.reviewStatus === "approved" && task.approvalStatus === "pending").length})`,
            },
          ]}
        />
      ) : null}
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
      {!visibleTasks.length ? (
        <EmptyState
          title={
            tenantApprovalView === "awaiting-tenant-approval"
              ? "No tasks are awaiting tenant approval"
              : query || status || priority
              ? "No tasks match these filters"
              : "No tasks are assigned"
          }
          description={
            tenantApprovalView === "awaiting-tenant-approval"
              ? "Manager-approved work for this client will appear here for the final delivery decision."
              : "Clear filters or wait for authorised work to be assigned."
          }
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
                tasks={visibleTasks}
                onOpen={setSelected}
                onStatusChange={(id, nextStatus) => {
                  const task = visibleTasks.find((item) => item.id === id);
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
                  <TaskMobileList tasks={visibleTasks} onOpen={setSelected} />
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
                    data={visibleTasks}
                    emptyTitle="No tasks"
                    emptyDescription="No task records are available."
                  />
                </div>
                <div className="md:hidden">
                  <TaskMobileList tasks={visibleTasks} onOpen={setSelected} />
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
        canChangeStatus={workspace !== "employee" && workspace !== "admin" && canUpdate}
        canManageAssignment={workspace !== "employee" && canUpdate}
        canTenantApprove={workspace === "admin" && canUpdate}
        onTenantApproval={handleTenantApproval}
        onUpdate={updateTask}
      />
      <ConfirmationDialog
        open={Boolean(reviewSubmission)}
        onOpenChange={(open) => !open && setReviewSubmission(null)}
        title="Submit task for review"
        description="Submitting this task for review locks status changes until your assigned manager approves or rejects the submission."
        confirmLabel="Submit for review"
        isConfirming={isSubmittingReview}
        onConfirm={() => void submitForReview()}
      >
        <p className="text-sm text-muted-foreground">
          Assigned manager: {reviewSubmission?.manager}
        </p>
      </ConfirmationDialog>
      </>}
    </div>
  );
}

function ActiveTaskTimer({ tasks }: { tasks: OperationalTask[] }) {
  const [now, setNow] = useState(() => Date.now());
  const activeTasks = tasks.filter((task) => task.status === "in-progress");
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStartedAt((current) => {
      const next = { ...current };
      tasks.forEach((task) => {
        const key = `employee-task-started-at:${task.id}`;
        if (task.status === "in-progress") {
          const saved = Number(window.sessionStorage.getItem(key));
          next[task.id] = saved || Date.now();
          if (!saved) window.sessionStorage.setItem(key, String(next[task.id]));
        } else {
          delete next[task.id];
          window.sessionStorage.removeItem(key);
        }
      });
      return next;
    });
  }, [tasks]);

  useEffect(() => {
    if (!activeTasks.length) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTasks.length]);

  if (!activeTasks.length) return null;
  return (
    <Card aria-label="Active task timer">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="font-medium">Active task timer</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Timing stops only after successful review submission.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTasks.map((task) => (
            <p key={task.id} className="text-sm font-medium">
              {task.title}: {formatElapsed(now - (startedAt[task.id] ?? now))}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function TaskMobileList({
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

function CreateTaskAction({ onCreate }: { onCreate: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Create task
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Create task"
        description="Creates a task for the current mock session."
      >
        <div className="pr-8">
          <h2 className="font-semibold">Create task</h2>
          <label className="mt-5 block text-sm font-medium">
            Task title
            <Input
              className="mt-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={title.trim().length < 3}
              onClick={() => {
                onCreate(title.trim());
                toast.success("Task created for this mock session.");
                setOpen(false);
                setTitle("");
              }}
            >
              Create task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
