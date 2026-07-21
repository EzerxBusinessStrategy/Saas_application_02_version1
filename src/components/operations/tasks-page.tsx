"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listOperationalTasks,
  listWorkLogs,
} from "@/features/operations/api/operations-api";
import { TaskBoard } from "@/components/operations/task-board";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
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
  done: "Done",
} as const;

function taskStatus(task: OperationalTask) {
  return task.status === "done"
    ? "complete"
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
  const [view, setView] = useState<"board" | "list">("board");
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
  const tasksQuery = useQuery({
    queryKey: ["operational-tasks", workspace, query, status, priority],
    queryFn: () =>
      listOperationalTasks(workspace, {
        query,
        status: status || undefined,
        priority: priority || undefined,
      }),
  });
  const logsQuery = useQuery({
    queryKey: ["operational-work-logs", workspace],
    queryFn: () => listWorkLogs(workspace),
  });
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
  const updateTask = (next: OperationalTask) => {
    setOverrides((current) => ({ ...current, [next.id]: next }));
    setSelected(next);
    toast.success("Task change saved for this mock session.");
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
  if (tasksQuery.isPending || logsQuery.isPending)
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
        title="Tasks"
        description="Plan, assign, complete, review, and approve client work within the active scope."
        actions={
          canCreate ? (
            <CreateTaskAction
              onCreate={(title) => {
                const task: OperationalTask = {
                  id: `TASK-MOCK-${createdTasks.length + 1}`,
                  tenantId: "acme",
                  clientId: "northstar",
                  client: "Northstar Labs",
                  engagement: "GST Filing",
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
                onStatusChange={(id, nextStatus) => {
                  const task = tasks.find((item) => item.id === id);
                  if (task && canUpdate)
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
        onUpdate={updateTask}
      />
    </div>
  );
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
