"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  decideTenantTaskApproval,
  getTenantAdminTaskReviewDetail,
  listTenantAdminTasks,
} from "@/features/operations/api/operations-api";
import {
  isTenantAdminTaskAwaitingReview,
  mapTenantAdminTask,
} from "@/features/operations/tenant-admin-task-map";
import { TaskBoard } from "@/components/operations/task-board";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { OperationalTask } from "@/types/operations";

const reviewBoardStatuses = ["review", "rejected", "done"] as const;

export function TenantTaskReviewPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [returnTaskId, setReturnTaskId] = useState<string | null>(null);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(null);
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);
  const tasksQuery = useQuery({
    queryKey: ["tenant-admin-tasks"],
    queryFn: () => listTenantAdminTasks(),
  });
  const reviewTasks = useMemo(
    () =>
      (tasksQuery.data ?? [])
        .filter(isTenantAdminTaskAwaitingReview)
        .map(mapTenantAdminTask),
    [tasksQuery.data],
  );
  const detailQuery = useQuery({
    queryKey: ["tenant-task-review-detail", selectedTask?.id],
    queryFn: () => getTenantAdminTaskReviewDetail(selectedTask!.id),
    enabled: Boolean(selectedTask),
  });
  const mutation = useMutation({
    mutationFn: ({
      taskId,
      decision,
      remarks,
    }: {
      taskId: string;
      decision: "approve" | "return";
      remarks?: string;
    }) => decideTenantTaskApproval(taskId, decision, remarks),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === "approve"
          ? "Tenant approval recorded. The task is complete."
          : "Task returned to the employee for rework.",
      );
      setReturnTaskId(null);
      setReturnRemarks("");
      setSelectedTask((current) => (current?.id === variables.taskId ? null : current));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant-admin-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-task-review-detail", variables.taskId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-operations-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-task-calendar"] }),
      ]);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "The tenant approval decision could not be saved.",
      ),
  });
  const requestedTaskId = searchParams.get("task");
  useEffect(() => {
    if (!requestedTaskId || requestedTaskId === openedTaskId) return;
    const requestedTask = reviewTasks.find((task) => task.id === requestedTaskId);
    if (!requestedTask) return;
    setSelectedTask(requestedTask);
    setOpenedTaskId(requestedTaskId);
  }, [openedTaskId, requestedTaskId, reviewTasks]);

  if (tasksQuery.isPending) return <LoadingState label="Loading task reviews" rows={4} />;
  if (tasksQuery.isError) {
    return <ErrorState title="Task reviews could not load" onRetry={() => void tasksQuery.refetch()} />;
  }

  const returnTask = reviewTasks.find((task) => task.id === returnTaskId) ?? null;

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="People & Teams"
        title="Task review"
        description={`${reviewTasks.length} submitted task${reviewTasks.length === 1 ? "" : "s"}. Drag each task to Returned or Done.`}
      />
      {reviewTasks.length ? (
        <TaskBoard
          tasks={reviewTasks}
          onOpen={setSelectedTask}
          showBoardOnMobile
          visibleStatuses={reviewBoardStatuses}
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
        <Card>
          <CardContent className="pt-[30px]">
            <EmptyState
              title="No pending reviews"
              description="When an employee submits work, it appears here for your approval."
            />
          </CardContent>
        </Card>
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
          return true;
        }}
        onUpdate={() => undefined}
        reviewDetail={detailQuery.data}
        isReviewDetailLoading={detailQuery.isLoading}
        decisionHeading="Tenant approval"
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
          if (returnTask) {
            mutation.mutate({
              taskId: returnTask.id,
              decision: "return",
              remarks: returnRemarks.trim(),
            });
          }
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Changes required
          <textarea
            className="min-h-24 rounded-[var(--radius-control)] border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={returnRemarks}
            onChange={(event) => setReturnRemarks(event.target.value)}
            placeholder="Describe what must be changed"
          />
        </label>
      </ConfirmationDialog>
    </div>
  );
}
