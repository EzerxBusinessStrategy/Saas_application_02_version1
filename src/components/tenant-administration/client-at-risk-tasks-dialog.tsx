"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { listTenantAdminAllocatedWork } from "@/features/tenant-admin/api/open-tasks-api";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function formatDateTime(value: string | null): string {
  if (!value) return "Not set";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "MMM d, yyyy h:mm a");
}

export function ClientAtRiskTasksDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ["tenant-admin-allocated-work", clientId, "at-risk"],
    queryFn: () => listTenantAdminAllocatedWork({ clientId, atRisk: true }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="At-risk tasks" description={`Why work for ${clientName} is at risk.`}>
        {query.isPending ? <LoadingState label="Loading at-risk tasks" rows={4} /> : null}
        {query.isError ? (
          <ErrorState
            title="At-risk tasks could not load"
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {query.data && query.data.tasks.length === 0 ? (
          <EmptyState
            title="No at-risk tasks"
            description="Open tasks for this client are currently on track."
          />
        ) : null}
        {query.data && query.data.tasks.length > 0 ? (
          <ul className="flex max-h-[28rem] flex-col divide-y overflow-y-auto">
            {query.data.tasks.map((task) => (
              <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                <p className="font-medium">{task.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {task.serviceName} · due {formatDateTime(task.plannedDueAt)}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {task.atRiskReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Link
            href={`/admin/allocated-work?clientId=${encodeURIComponent(clientId)}&atRisk=true`}
            className={buttonVariants({ variant: "outline" })}
          >
            View in Allocated work
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
