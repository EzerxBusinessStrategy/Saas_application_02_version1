"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEmployeeDashboard, type EmployeeDashboard } from "@/features/employee/api/employee-dashboard-api";
import {
  createEmployeeManagerTask,
  decideEmployeeManagerReview,
  getEmployeeManagerTaskOptions,
  getEmployeeManagerReviewDetail,
  listEmployeeManagerClients,
  listEmployeeManagerReviews,
} from "@/features/employee/api/employee-manager-api";
import { getEmployeeNotifications } from "@/features/employee/api/employee-notifications-api";
import { getEmployeeProfile } from "@/features/employee/api/employee-profile-api";
import { TaskBoard } from "@/components/operations/task-board";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { BoxBuildLoader } from "@/components/shared/box-build-loader";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/shared/date-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OperationalTask } from "@/types/operations";
import {
  employeesForServiceAllocation,
  specializationLabel,
} from "@/components/tenant-administration/employee-specialization-picker";

export function EmployeeWorkspace({
  section = "day",
}: {
  section?:
    | "day"
    | "notifications"
    | "profile"
    | "clients"
    | "assign-task"
    | "task-reviews";
}) {
  if (section === "day") return <EmployeeDayDashboard />;
  if (section === "clients") return <EmployeeManagerClientsPage />;
  if (section === "assign-task") return <EmployeeManagerAssignTaskPage />;
  if (section === "task-reviews") return <EmployeeManagerTaskReviewsPage />;
  return <EmployeeInfo section={section} />;
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
          href="/employee/tasks"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open tasks
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
  const selectedServiceName = options?.services.find((service) => service.id === selectedService)?.name ?? "";
  const allocatableEmployees = employeesForServiceAllocation(
    (options?.employees ?? []).filter((employee) => employee.employmentStatus === "active"),
    selectedServiceName,
  );
  const selectedEmployee = employeeId || allocatableEmployees[0]?.id || "";
  const assign = () => {
    if (!options || !selectedClient || !selectedService || !selectedEmployee || !title.trim()) return;
    const country = options.countries[0];
    const rate = options.rateItems.find((item) => item.serviceId === selectedService && (!item.clientId || item.clientId === selectedClient));
    if (!country) {
      setMessage("No active financial year is configured for this tenant.");
      return;
    }
    if (!rate) {
      setMessage("No rate card is configured for the selected client and service.");
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
      billing: { rateSource: "existing", rateCardItemId: rate.id, quantity: 1, discountValue: 0 },
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
          <ManagerField label="Assign employee"><select className={managerInputClass} value={selectedEmployee} onChange={(event) => setEmployeeId(event.target.value)}>{allocatableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {specializationLabel(employee.skills)}</option>)}</select></ManagerField>
          <ManagerField label="Priority"><select className={managerInputClass} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></ManagerField>
          <ManagerField label="Due date"><DatePicker value={dueDate} onChange={setDueDate} aria-label="Due date" /></ManagerField>
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [returnTaskId, setReturnTaskId] = useState<string | null>(null);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(null);
  const query = useQuery({ queryKey: ["employee-manager-reviews"], queryFn: listEmployeeManagerReviews });
  const detailQuery = useQuery({
    queryKey: ["employee-manager-review-detail", selectedTask?.id],
    queryFn: () => getEmployeeManagerReviewDetail(selectedTask!.id),
    enabled: Boolean(selectedTask),
  });
  const mutation = useMutation({
    mutationFn: ({ taskId, decision, remarks }: { taskId: string; decision: "approve" | "return"; remarks?: string }) => decideEmployeeManagerReview(taskId, decision, remarks),
    onSuccess: async (_result, variables) => {
      toast.success(variables.decision === "approve" ? "Task completed. The invoice queue is ready for the Tenant Admin." : "Changes requested and task returned to the employee.");
      setReturnTaskId(null);
      setReturnRemarks("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee-manager-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["employee-manager-review-detail", variables.taskId] }),
        queryClient.invalidateQueries({ queryKey: ["operational-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["employee-notifications"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The review decision could not be saved."),
  });

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || selectedTask?.id === taskId || !query.data?.length) return;
    const match = query.data.find((task) => task.id === taskId);
    if (!match) return;
    setSelectedTask({
      id: match.id,
      tenantId: "authenticated",
      clientId: match.id,
      client: match.clientName,
      engagement: "Submitted work",
      workGroup: "Assigned work group",
      managerId: "current",
      manager: "Current manager",
      assigneeId: match.id,
      assignee: match.employeeName,
      title: match.title,
      description: match.taskComment ?? "No submission comment.",
      priority: "medium",
      complexity: "standard",
      status: match.submissionStatus === "returned" ? "rejected" : match.status === "completed" ? "done" : "review",
      sla: "on-track",
      dueDate: `Submitted ${format(parseISO(match.submittedAt), "d MMM, p")}`,
      checklist: [],
      dependencyIds: [],
      attachmentCount: 0,
      commentCount: 0,
      reviewStatus: match.submissionStatus === "returned" ? "changes-requested" : match.status === "completed" ? "approved" : "pending",
      approvalStatus: match.status === "completed" ? "approved" : "pending",
      blocked: match.submissionStatus === "returned",
    });
  }, [query.data, searchParams, selectedTask?.id]);
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
    status: task.submissionStatus === "returned" ? "rejected" : task.status === "completed" ? "done" : "review",
    sla: "on-track",
    dueDate: `Submitted ${format(parseISO(task.submittedAt), "d MMM, p")}`,
    checklist: [],
    dependencyIds: [],
    attachmentCount: 0,
    commentCount: 0,
    reviewStatus: task.submissionStatus === "returned" ? "changes-requested" : task.status === "completed" ? "approved" : "pending",
    approvalStatus: task.status === "completed" ? "approved" : "pending",
    blocked: task.submissionStatus === "returned",
  }));
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader eyebrow="Manager" title="Task Reviews" description={`${query.data.length} submitted task${query.data.length === 1 ? "" : "s"}. Drag each task to Returned or Done.`} />
      {query.data.length ? (
        <TaskBoard
          tasks={boardTasks}
          onOpen={setSelectedTask}
          showBoardOnMobile
          visibleStatuses={["review", "rejected", "done"]}
          canDragTask={(task) => !mutation.isPending && task.status === "review"}
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
      <TaskDetailsDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        workLogs={[]}
        canUpdate={false}
        canChangeStatus={false}
        canManageAssignment={false}
        canTenantApprove={Boolean(selectedTask && selectedTask.status === "review")}
        onTenantApproval={async (task, decision, remarks) => {
          await mutation.mutateAsync({ taskId: task.id, decision, remarks });
          setSelectedTask(null);
          return true;
        }}
        onUpdate={() => undefined}
        reviewDetail={detailQuery.data}
        isReviewDetailLoading={detailQuery.isLoading}
        decisionHeading="Manager review decision"
      />
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

function EmployeeInfo({ section }: { section: "notifications" | "profile" }) {
  const notifications = useQuery({ queryKey: ["employee-notifications", "page"], queryFn: () => getEmployeeNotifications(), enabled: section === "notifications", refetchInterval: 10000 });
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
