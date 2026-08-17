"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Star } from "lucide-react";
import {
  listPendingTaskFeedback,
  type PendingTaskFeedbackItem,
} from "@/features/client-portal/api/task-feedback-api";
import { ClientTaskFeedbackDialog } from "@/components/operations/client-task-feedback-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIndiaTimestamp } from "@/lib/india-time";

function daysRemaining(expiresAt: string): number {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 86_400_000);
}

export function ClientTaskFeedbackPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PendingTaskFeedbackItem | null>(null);
  const query = useQuery({
    queryKey: ["client-task-feedback-pending"],
    queryFn: listPendingTaskFeedback,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  if (query.isPending) return <LoadingState label="Loading feedback" rows={4} />;
  if (query.isError) {
    return <ErrorState title="Feedback could not load" onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Rate completed tasks within 60 days of completion. After that window, unanswered items leave the portal and are recorded in tenant and employee logs."
        actions={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Tasks waiting for your review</CardTitle>
          <CardDescription>
            {items.length === 0
              ? "No pending reviews."
              : `${items.length} task${items.length === 1 ? "" : "s"} still open for feedback.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <EmptyState
              title="No pending feedback"
              description="When an invoice is sent for a completed task, it appears here for 60 days so you can rate the work."
            />
          ) : (
            items.map((item) => {
              const remaining = daysRemaining(item.expiresAt);
              return (
                <div
                  key={item.taskId}
                  className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.taskTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.employeeName} · Invoice {item.invoiceNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Completed {formatIndiaTimestamp(item.completedAt)} · {remaining} day
                      {remaining === 1 ? "" : "s"} left
                    </p>
                  </div>
                  <Button onClick={() => setSelected(item)}>
                    <Star data-icon="inline-start" />
                    Rate task
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {selected ? (
        <ClientTaskFeedbackDialog
          item={selected}
          open
          onSubmitted={() => {
            setSelected(null);
            void queryClient.invalidateQueries({ queryKey: ["client-task-feedback-pending"] });
          }}
          onDismiss={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
