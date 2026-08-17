"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  listEmployeeTaskFeedbackLog,
  type TaskFeedbackLogItem,
} from "@/features/client-portal/api/task-feedback-api";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StarRatingDisplay } from "@/components/shared/star-rating";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIndiaTimestamp } from "@/lib/india-time";

const columns: ColumnDef<TaskFeedbackLogItem>[] = [
  {
    header: "Task",
    accessorKey: "taskTitle",
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="font-medium">{row.original.taskTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.original.clientName}</p>
      </div>
    ),
  },
  {
    header: "Task rating",
    accessorKey: "taskRating",
    cell: ({ row }) => <StarRatingDisplay value={row.original.taskRating} />,
  },
  {
    header: "Your rating",
    accessorKey: "employeeRating",
    cell: ({ row }) => <StarRatingDisplay value={row.original.employeeRating} />,
  },
  {
    header: "Submitted (IST)",
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">{formatIndiaTimestamp(row.original.createdAt)}</span>
    ),
  },
];

export function EmployeeTaskFeedbackLogPage() {
  const query = useQuery({
    queryKey: ["employee-task-feedback-log"],
    queryFn: listEmployeeTaskFeedbackLog,
    refetchInterval: 30_000,
  });

  if (query.isPending) return <LoadingState label="Loading your feedback" rows={4} />;
  if (query.isError) {
    return (
      <ErrorState title="Feedback could not load" onRetry={() => void query.refetch()} />
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My feedback"
        description="Client ratings on tasks you worked on. Only your feedback is shown here."
        actions={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Feedback received</CardTitle>
          <CardDescription>{items.length} review{items.length === 1 ? "" : "s"} from clients.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="No feedback yet"
              description="When clients rate completed tasks after invoice delivery, their reviews appear here."
            />
          ) : (
            <DataTable
              caption="Employee feedback received"
              columns={columns}
              data={items}
              emptyTitle="No feedback yet"
              emptyDescription="Client ratings on your completed tasks appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
