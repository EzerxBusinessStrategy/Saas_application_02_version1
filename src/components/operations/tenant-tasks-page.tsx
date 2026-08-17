"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  decideTenantTaskApproval,
  getTenantAdminTaskReviewDetail,
  listTenantAdminTasks,
  type TenantAdminTask,
} from "@/features/operations/api/operations-api";
import { listTenantServiceRequests } from "@/features/administration/api/tenant-service-requests-api";
import { TenantServiceRequestsInbox } from "@/components/tenant-administration/service-requests";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { DataTable } from "@/components/operations/data-table";
import { TaskMobileList, taskStatus } from "@/components/operations/tasks-page";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OperationalTask } from "@/types/operations";

export function TenantTasksPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"requests" | "review">("requests");
  const [selected, setSelected] = useState<OperationalTask | null>(null);
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);
  const [decidingTaskId, setDecidingTaskId] = useState<string | null>(null);
  const submittedRequestsQuery = useQuery({
    queryKey: ["tenant-service-requests", "submitted"],
    queryFn: () => listTenantServiceRequests("submitted"),
  });
  const tasksQuery = useQuery({
    queryKey: ["tenant-admin-tasks"],
    queryFn: async () => (await listTenantAdminTasks()).map(mapTenantAdminTask),
  });
  const reviewDetailQuery = useQuery({
    queryKey: ["tenant-task-review-detail", selected?.id],
    queryFn: () => getTenantAdminTaskReviewDetail(selected!.id),
    enabled: Boolean(selected),
  });
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const awaitingApproval = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "review" &&
          task.reviewStatus === "pending" &&
          task.approvalStatus === "pending",
      ),
    [tasks],
  );
  const requestedTaskId = searchParams.get("task");
  useEffect(() => {
    if (!requestedTaskId || requestedTaskId === openedTaskId) return;
    const requestedTask = tasks.find((task) => task.id === requestedTaskId);
    if (!requestedTask) return;
    setSelected(requestedTask);
    setOpenedTaskId(requestedTaskId);
    setTab("review");
  }, [openedTaskId, requestedTaskId, tasks]);
  const handleTenantApproval = async (
    task: OperationalTask,
    decision: "approve" | "return",
    remarks = "",
  ) => {
    if (decidingTaskId) return false;
    setDecidingTaskId(task.id);
    try {
      const saved = mapTenantAdminTask(
        await decideTenantTaskApproval(task.id, decision, remarks),
      );
      setSelected((current) => (current?.id === saved.id ? saved : current));
      void queryClient.invalidateQueries({ queryKey: ["tenant-admin-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-operations-overview"] });
      void queryClient.invalidateQueries({
        queryKey: ["tenant-task-review-detail", task.id],
      });
      toast.success(
        decision === "approve"
          ? "Tenant approval recorded. The task is complete."
          : "Task returned to the employee for rework.",
      );
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The tenant approval decision could not be saved.",
      );
      return false;
    } finally {
      setDecidingTaskId(null);
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
    return <LoadingState label="Loading client requests and tasks" rows={5} />;
  if (tasksQuery.isError)
    return (
      <ErrorState
        title="Tasks could not load"
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  const submittedCount = submittedRequestsQuery.data?.length ?? 0;
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Delivery"
        title="Tasks"
        description="Review client service requests, allot the responsible employee, and approve finished work."
      />
      <ResponsiveTabs
        label="Client work queue"
        value={tab}
        onValueChange={(value) => setTab(value as "requests" | "review")}
        tabs={[
          { value: "requests", label: `Client requests (${submittedCount})` },
          {
            value: "review",
            label: `Submitted for review (${awaitingApproval.length})`,
          },
        ]}
      >
        {tab === "requests" ? (
          <TenantServiceRequestsInbox />
        ) : awaitingApproval.length ? (
          <Card>
            <CardContent className="pt-0">
              <div className="hidden md:block">
                <DataTable
                  caption="Tasks submitted for tenant review"
                  columns={columns}
                  data={awaitingApproval}
                  emptyTitle="No tasks are submitted for review"
                  emptyDescription="Employee submissions will appear here for a final decision."
                />
              </div>
              <div className="md:hidden">
                <TaskMobileList tasks={awaitingApproval} onOpen={setSelected} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="No tasks are submitted for review"
            description="When an employee finishes work, it appears here for your approval."
          />
        )}
      </ResponsiveTabs>
      <TaskDetailsDrawer
        task={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        workLogs={[]}
        canUpdate={false}
        canChangeStatus={false}
        canManageAssignment={false}
        canTenantApprove
        onTenantApproval={handleTenantApproval}
        onUpdate={() => {
          toast.error("Task updates must be saved through the backend workflow.");
        }}
        reviewDetail={reviewDetailQuery.data}
        isReviewDetailLoading={reviewDetailQuery.isLoading}
      />
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
    status: task.latestSubmissionStatus === "returned" ? "rejected" : mapTaskStatus(task.status),
    sla: task.slaStatus === "near_breach" || task.slaStatus === "breached" ? "at-risk" : "on-track",
    dueDate: task.plannedDueAt ? formatTaskDate(task.plannedDueAt) : "No due date",
    checklist: [],
    dependencyIds: [],
    attachmentCount: 0,
    commentCount: 0,
    reviewStatus:
      task.latestSubmissionStatus === "returned"
        ? "changes-requested"
        : ["submitted", "manager_review"].includes(task.status)
        ? "pending"
        : task.status === "tenant_approval"
          ? "approved"
          : task.status === "approved"
          ? "pending"
          : task.status === "returned"
            ? "changes-requested"
            : "not-required",
    approvalStatus: ["manager_review", "tenant_approval"].includes(task.status) ? "pending" : "not-required",
    reviewComment: task.latestReviewRemarks,
    blocked: task.latestSubmissionStatus === "returned" || task.status === "returned",
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
