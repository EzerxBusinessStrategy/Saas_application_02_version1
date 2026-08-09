"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  decideTenantTaskApproval,
  createTenantAdminEmployee,
  createTenantAdminTask,
  listOperationalTasks,
  listTenantAdminTaskOptions,
  listTenantAdminTasks,
  listWorkLogs,
  startEmployeeTask,
  submitEmployeeTaskForReview,
  type CreateTenantAdminTaskInput,
  type TenantAdminEmployeeOption,
  type TenantAdminService,
  type TenantAdminTask,
  type TenantAdminTaskOptions,
} from "@/features/operations/api/operations-api";
import { TaskBoard } from "@/components/operations/task-board";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { NewServiceDialog } from "@/components/tenant-administration/service-management";
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
    queryFn: async () => {
      if (workspace === "admin") {
        return (await listTenantAdminTasks(selectedClientId ?? undefined)).map(
          mapTenantAdminTask,
        );
      }

      return listOperationalTasks(workspace, {
        query,
        status: status || undefined,
        priority: priority || undefined,
      });
    },
    enabled: true,
  });
  const logsQuery = useQuery({
    queryKey: ["operational-work-logs", workspace, selectedClientId],
    queryFn: () => listWorkLogs(workspace),
    enabled: workspace !== "admin",
  });
  const tasks = useMemo(() => {
    const items = [
      ...(tasksQuery.data ?? []),
      ...(workspace === "admin" ? [] : createdTasks),
    ].map(
      (task) => overrides[task.id] ?? task,
    );
    return items.filter(
      (task) =>
        (!query || task.title.toLowerCase().includes(query.toLowerCase())) &&
        (!status || task.status === status) &&
        (!priority || task.priority === priority),
    );
  }, [createdTasks, overrides, priority, query, status, tasksQuery.data, workspace]);
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
    if (workspace === "admin") {
      toast.error("Task updates must be saved through the backend workflow.");
      return;
    }
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
  if (tasksQuery.isPending || (workspace !== "admin" && logsQuery.isPending))
    return <LoadingState label="Loading task delivery workflow" rows={5} />;
  if (tasksQuery.isError || (workspace !== "admin" && logsQuery.isError))
    return (
      <ErrorState
        title="Tasks could not load"
        onRetry={() => {
          void tasksQuery.refetch();
          if (workspace !== "admin") void logsQuery.refetch();
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
          canCreate ? (
            workspace === "admin" ? (
              <TenantAdminCreateTaskAction
                initialClientId={selectedClientId ?? undefined}
                onCreated={() => {
                  void queryClient.invalidateQueries({ queryKey: ["operational-tasks", workspace] });
                  void queryClient.invalidateQueries({ queryKey: ["admin-operations-overview"] });
                }}
              />
            ) : (
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
            )
          ) : undefined
        }
      />
      <>
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
        canManageAssignment={workspace !== "employee" && workspace !== "admin" && canUpdate}
        canTenantApprove={false}
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
      </>
    </div>
  );
}

function mapTenantAdminTask(task: TenantAdminTask): OperationalTask {
  const assignee = task.assignees.length
    ? task.assignees.map((item) => item.name).join(", ")
    : "Unassigned";

  return {
    id: task.id,
    tenantId: "authenticated",
    clientId: task.clientId,
    client: task.clientName,
    engagement: task.serviceName,
    workGroup: task.workGroupName ?? "No work group",
    managerId: "",
    manager: "Manager not assigned",
    assigneeId: task.assignees[0]?.id ?? "",
    assignee: task.assigneeCount > 1 ? `${task.assigneeCount} employees` : assignee,
    title: task.title,
    description: task.description ?? "No description recorded.",
    priority: mapTaskPriority(task.priority),
    complexity: "standard",
    status: mapTaskStatus(task.status),
    sla: task.slaStatus === "near_breach" || task.slaStatus === "breached" ? "at-risk" : "on-track",
    dueDate: task.plannedDueAt ? formatTaskDate(task.plannedDueAt) : "No due date",
    checklist: [],
    dependencyIds: [],
    attachmentCount: 0,
    commentCount: 0,
    reviewStatus:
      task.status === "tenant_approval"
        ? "approved"
        : ["submitted", "manager_review", "approved"].includes(task.status)
          ? "pending"
          : task.status === "returned"
            ? "changes-requested"
            : "not-required",
    approvalStatus: task.status === "tenant_approval" ? "pending" : "not-required",
    blocked: task.status === "returned",
  };
}

function mapTaskPriority(priority: TenantAdminTask["priority"]): OperationalTask["priority"] {
  if (priority === "urgent" || priority === "high") return "high";
  if (priority === "normal") return "medium";
  return "low";
}

function mapTaskStatus(status: TenantAdminTask["status"]): OperationalTask["status"] {
  if (status === "in_progress") return "in-progress";
  if (["submitted", "manager_review", "tenant_approval", "approved"].includes(status)) return "review";
  if (status === "returned") return "rejected";
  if (status === "completed") return "done";
  return "to-do";
}

function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const emptyTenantTaskInput = {
  serviceId: "",
  countryCode: "",
  title: "",
  description: "",
  priority: "normal" as CreateTenantAdminTaskInput["priority"],
  plannedDueAt: "",
  workGroupId: "",
  employeeIds: [] as string[],
  rateCardItemId: "",
  taskType: "",
  unitType: "per_task" as "per_task" | "per_hour" | "per_filing" | "per_unit",
  rateAmount: "",
  currencyCode: "INR",
  taxCode: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  saveToRateCard: true,
  oneTimeReason: "",
  discountType: "" as "" | "percentage" | "fixed",
  discountValue: "",
};

function findBestServiceRate(
  rateItems: TenantAdminTaskOptions["rateItems"],
  serviceId: string,
  clientId: string,
) {
  return (
    rateItems.find((rate) => rate.serviceId === serviceId && rate.clientId === clientId) ??
    rateItems.find((rate) => rate.serviceId === serviceId && !rate.clientId)
  );
}

function TenantAdminCreateTaskAction({
  initialClientId,
  onCreated,
}: {
  initialClientId?: string;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [input, setInput] = useState(emptyTenantTaskInput);
  const [isSaving, setIsSaving] = useState(false);
  const optionsQuery = useQuery({
    queryKey: ["tenant-admin-task-options"],
    queryFn: listTenantAdminTaskOptions,
  });
  const refetchTaskOptions = optionsQuery.refetch;
  const options: TenantAdminTaskOptions = optionsQuery.data ?? {
    clients: [],
    services: [],
    employees: [],
    workGroups: [],
    rateItems: [],
    countries: [],
  };
  useEffect(() => {
    if (open) void refetchTaskOptions();
  }, [open, refetchTaskOptions]);
  const isLoadingOptions = optionsQuery.isPending;
  useEffect(() => setClientId(initialClientId ?? ""), [initialClientId]);
  const workGroups = options.workGroups.filter(
    (group) => !group.clientId || group.clientId === clientId,
  );
  const selectedRate = useMemo(() => {
    const matchingRate = options.rateItems.find(
      (rate) =>
        rate.id === input.rateCardItemId &&
        rate.serviceId === input.serviceId &&
        (!rate.clientId || rate.clientId === clientId),
    );
    return matchingRate ?? findBestServiceRate(options.rateItems, input.serviceId, clientId);
  }, [clientId, input.rateCardItemId, input.serviceId, options.rateItems]);
  const quantity = 1;
  const unitRate = selectedRate?.rateAmount ?? 0;
  const estimatedAmount = quantity * unitRate;
  const estimateCurrency = selectedRate?.currencyCode ?? input.currencyCode;
  const safeCurrency = /^[A-Z]{3}$/.test(estimateCurrency) ? estimateCurrency : "INR";
  const hasActiveEmployees = options.employees.length > 0;
  const selectedCountry = options.countries.find((country) => country.countryCode === input.countryCode);
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 2,
  });
  const toggleEmployee = (employeeId: string) => {
    setInput((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employeeId)
        ? current.employeeIds.filter((id) => id !== employeeId)
        : [...current.employeeIds, employeeId],
    }));
  };
  const selectServiceRate = (serviceId: string) => {
    const rate = findBestServiceRate(options.rateItems, serviceId, clientId);
    setInput((current) => ({
      ...current,
      serviceId,
      rateCardItemId: rate?.id ?? "",
      taskType: rate?.taskType ?? current.taskType,
      unitType: rate?.unitType ?? current.unitType,
      rateAmount: rate ? String(rate.rateAmount) : current.rateAmount,
      currencyCode: rate?.currencyCode ?? current.currencyCode,
    }));
  };
  useEffect(() => {
    if (!clientId || !input.serviceId || input.rateCardItemId) return;
    const rate = findBestServiceRate(options.rateItems, input.serviceId, clientId);
    if (!rate) return;
    setInput((current) => ({
      ...current,
      rateCardItemId: rate.id,
      taskType: rate.taskType,
      unitType: rate.unitType,
      rateAmount: String(rate.rateAmount),
      currencyCode: rate.currencyCode,
    }));
  }, [clientId, input.rateCardItemId, input.serviceId, options.rateItems]);
  useEffect(() => {
    if (!open || input.countryCode || !options.countries[0]) return;
    setInput((current) => ({ ...current, countryCode: options.countries[0]?.countryCode ?? "" }));
  }, [input.countryCode, open, options.countries]);
  const handleServiceCreated = (service: TenantAdminService) => {
    const rate = service.rates[0];
    queryClient.setQueryData<TenantAdminTaskOptions>(["tenant-admin-task-options"], (current) => ({
      clients: current?.clients ?? [],
      employees: current?.employees ?? [],
      workGroups: current?.workGroups ?? [],
      countries: current?.countries ?? [],
      services: [...(current?.services ?? []).filter((item) => item.id !== service.id), { id: service.id, name: service.name }],
      rateItems: rate
        ? [
            ...(current?.rateItems ?? []).filter((item) => item.id !== rate.id),
            {
              id: rate.id,
              clientId: null,
              serviceId: service.id,
              label: `${rate.taskType} - ${formatRateMoney(rate.rateAmount, rate.currencyCode)} ${billingUnitLabel(rate.unitType)}`,
              taskType: rate.taskType,
              unitType: rate.unitType,
              rateAmount: rate.rateAmount,
              currencyCode: rate.currencyCode,
              taxCode: rate.taxCode,
            },
          ]
        : (current?.rateItems ?? []),
    }));
    if (rate) {
      setInput((current) => ({
        ...current,
        serviceId: service.id,
        rateCardItemId: rate.id,
        taskType: rate.taskType,
        unitType: rate.unitType,
        rateAmount: String(rate.rateAmount),
        currencyCode: rate.currencyCode,
      }));
    } else {
      setInput((current) => ({ ...current, serviceId: service.id, rateCardItemId: "" }));
    }
  };
  const handleEmployeeCreated = (employee: TenantAdminEmployeeOption) => {
    queryClient.setQueryData<TenantAdminTaskOptions>(["tenant-admin-task-options"], (current) => ({
      clients: current?.clients ?? [],
      services: current?.services ?? [],
      workGroups: current?.workGroups ?? [],
      rateItems: current?.rateItems ?? [],
      countries: current?.countries ?? [],
      employees: [...(current?.employees ?? []).filter((item) => item.id !== employee.id), employee],
    }));
    setInput((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employee.id) ? current.employeeIds : [...current.employeeIds, employee.id],
    }));
  };
  const submit = async () => {
    setIsSaving(true);
    try {
      await createTenantAdminTask({
        clientId,
        serviceId: input.serviceId,
        countryCode: input.countryCode,
        title: input.title.trim(),
        description: input.description.trim(),
        priority: input.priority,
        plannedDueAt: input.plannedDueAt ? new Date(input.plannedDueAt).toISOString() : undefined,
        workGroupId: input.workGroupId || undefined,
        employeeIds: input.employeeIds,
        billing:
          {
            rateSource: "existing",
            rateCardItemId: selectedRate?.id ?? input.rateCardItemId,
            quantity: 1,
            discountType: input.discountType || undefined,
            discountValue: Number(input.discountValue || 0),
          },
      });
      toast.success("Task created.");
      setOpen(false);
      setInput(emptyTenantTaskInput);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task could not be created.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setClientId(initialClientId ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Create task
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Create task"
        description="Create a tenant-scoped client task."
        className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"
      >
        <div className="pr-8">
          <h2 className="text-lg font-semibold">Create task</h2>
          {isLoadingOptions ? (
            <p className="mt-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm text-muted-foreground">
              Loading clients, services, employees, work groups and rates...
            </p>
          ) : null}
          {optionsQuery.isError ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-destructive/30 px-3 py-2">
              <p className="text-sm text-destructive">Task form options could not load.</p>
              <Button variant="outline" size="sm" onClick={() => void optionsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">
              Client
              <Select
                className="mt-1"
                disabled={isLoadingOptions || optionsQuery.isError}
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setInput((current) => ({ ...current, workGroupId: "", rateCardItemId: "" }));
                }}
              >
                <option value="">{isLoadingOptions ? "Loading clients..." : "Select client"}</option>
                {options.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="text-sm font-medium">
              <div className="flex items-center justify-between gap-2">
                <span>Service</span>
                <NewServiceDialog
                  triggerLabel="Custom service"
                  triggerSize="sm"
                  onCreated={() => {
                    void queryClient.invalidateQueries({ queryKey: ["tenant-admin-services"] });
                  }}
                  onCreatedService={handleServiceCreated}
                />
              </div>
              <Select
                className="mt-1"
                disabled={isLoadingOptions || optionsQuery.isError}
                value={input.serviceId}
                onChange={(event) => selectServiceRate(event.target.value)}
              >
                <option value="">{isLoadingOptions ? "Loading services..." : "Select service"}</option>
                {options.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="text-sm font-medium">
              Priority
              <Select
                className="mt-1"
                value={input.priority}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    priority: event.target.value as CreateTenantAdminTaskInput["priority"],
                  }))
                }
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </Select>
            </label>
            <label className="text-sm font-medium">
              Country calendar
              <Select
                className="mt-1"
                disabled={isLoadingOptions || optionsQuery.isError}
                value={input.countryCode}
                onChange={(event) => setInput((current) => ({ ...current, countryCode: event.target.value }))}
              >
                <option value="">{isLoadingOptions ? "Loading countries..." : "Select country"}</option>
                {options.countries.map((country) => (
                  <option key={country.countryCode} value={country.countryCode}>
                    {country.name}
                  </option>
                ))}
              </Select>
              {selectedCountry ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selectedCountry.financialYearLabel}: {selectedCountry.startsOn} to {selectedCountry.endsOn}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Task title
              <Input
                className="mt-1"
                value={input.title}
                maxLength={200}
                onChange={(event) => setInput((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Description
              <textarea
                className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border bg-input p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                value={input.description}
                maxLength={2000}
                onChange={(event) => setInput((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium">
              Due date and time
              <Input
                className="mt-1"
                type="datetime-local"
                value={input.plannedDueAt}
                onChange={(event) => setInput((current) => ({ ...current, plannedDueAt: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium">
              Work group
              <Select
                className="mt-1"
                disabled={isLoadingOptions || optionsQuery.isError || !hasActiveEmployees}
                value={input.workGroupId}
                onChange={(event) => setInput((current) => ({ ...current, workGroupId: event.target.value }))}
              >
                <option value="">No work group</option>
                {workGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
              {!hasActiveEmployees ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Create at least one active employee before creating or assigning a work group.
                </span>
              ) : null}
            </label>
          </div>
          <fieldset className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Assign employees</span>
              <NewEmployeeDialog onCreated={handleEmployeeCreated} />
            </div>
            <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-[var(--radius-control)] border p-3 sm:grid-cols-2">
              {options.employees.length ? (
                options.employees.map((employee) => (
                  <label key={employee.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      disabled={isLoadingOptions || optionsQuery.isError}
                      checked={input.employeeIds.includes(employee.id)}
                      onChange={() => toggleEmployee(employee.id)}
                    />
                    <span>{employee.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active employees are available.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Select at least one employee. Work group is optional.
            </p>
          </fieldset>
          <fieldset className="mt-5 rounded-[var(--radius-card)] border p-4">
            <legend className="px-1 text-sm font-semibold">Billing and Rate</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {selectedRate ? (
                <dl className="grid gap-3 rounded-[var(--radius-control)] border bg-muted/30 p-3 text-sm sm:col-span-2 sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Task type</dt>
                    <dd className="mt-1 font-medium">{selectedRate.taskType}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Billing unit</dt>
                    <dd className="mt-1 font-medium capitalize">{billingUnitLabel(selectedRate.unitType)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Unit rate</dt>
                    <dd className="mt-1 font-medium">{formatRateMoney(selectedRate.rateAmount, selectedRate.currencyCode)}</dd>
                  </div>
                </dl>
              ) : input.serviceId ? (
                <p className="rounded-[var(--radius-control)] border px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
                  No active rate exists for this service. Use Custom service to add the service and rate first.
                </p>
              ) : null}
              <div className="text-sm">
                <p className="text-muted-foreground">Estimated amount</p>
                <p className="mt-1 text-lg font-semibold">{money.format(estimatedAmount)}</p>
              </div>
              <label className="text-sm font-medium">
                Discount
                <Select className="mt-1" value={input.discountType} onChange={(event) => setInput((current) => ({ ...current, discountType: event.target.value as typeof current.discountType }))}>
                  <option value="">No discount</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </label>
              <label className="text-sm font-medium">
                Discount value
                <Input className="mt-1" type="number" min="0" disabled={!input.discountType} value={input.discountValue} onChange={(event) => setInput((current) => ({ ...current, discountValue: event.target.value }))} />
              </label>
            </div>
          </fieldset>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                isSaving ||
                isLoadingOptions ||
                optionsQuery.isError ||
                !clientId ||
                !input.serviceId ||
                !input.countryCode ||
                input.title.trim().length < 3 ||
                !selectedRate ||
                input.employeeIds.length === 0
              }
              onClick={() => void submit()}
            >
              {isSaving ? "Creating..." : "Create task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewEmployeeDialog({ onCreated }: { onCreated: (employee: TenantAdminEmployeeOption) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [skills, setSkills] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState("40");
  const [isManager, setIsManager] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const employee = await createTenantAdminEmployee({
        name: name.trim(),
        email: email.trim(),
        password,
        employeeCode: employeeCode.trim() || undefined,
        isManager,
        skills: skills.split(",").map((value) => value.trim()).filter(Boolean),
        experienceLevel: experienceLevel ? (experienceLevel as "junior" | "mid" | "senior" | "lead") : undefined,
        weeklyCapacityHours: Number(weeklyCapacityHours) || 40,
      });
      onCreated(employee);
      setName("");
      setEmail("");
      setPassword("");
      setEmployeeCode("");
      setSkills("");
      setExperienceLevel("");
      setWeeklyCapacityHours("40");
      setIsManager(false);
      setOpen(false);
      toast.success("Employee created and selected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus data-icon="inline-start" />
          Create employee
        </Button>
      </DialogTrigger>
      <DialogContent title="Create employee" description="Add an active employee for task assignment." className="max-w-md">
        <div className="grid gap-4 pr-8">
          <label className="text-sm font-medium">
            Name
            <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Email
            <Input className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Password
            <Input className="mt-1" type="password" value={password} minLength={8} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Employee code
            <Input className="mt-1" value={employeeCode} placeholder="Auto-generated if empty" onChange={(event) => setEmployeeCode(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Skills (optional)
            <Input className="mt-1" value={skills} placeholder="GST, Payroll, Compliance" onChange={(event) => setSkills(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Level (optional)
            <Select className="mt-1" value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}>
              <option value="">Not set</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </Select>
          </label>
          <label className="text-sm font-medium">
            Weekly capacity hours
            <Input className="mt-1" type="number" min="1" max="168" value={weeklyCapacityHours} onChange={(event) => setWeeklyCapacityHours(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isManager} onChange={(event) => setIsManager(event.target.checked)} />
            Make this employee a manager
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || name.trim().length < 2 || !email.trim() || password.length < 8 || !Number(weeklyCapacityHours)} onClick={() => void submit()}>
              {saving ? "Creating..." : "Create employee"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRateMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function billingUnitLabel(unit: string) {
  return unit.replace("per_", "per ");
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
