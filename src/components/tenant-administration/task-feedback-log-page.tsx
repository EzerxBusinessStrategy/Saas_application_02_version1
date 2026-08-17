"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  listTenantTaskFeedbackLog,
  type TaskFeedbackLogItem,
} from "@/features/client-portal/api/task-feedback-api";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StarRatingDisplay } from "@/components/shared/star-rating";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIndiaTimestamp } from "@/lib/india-time";
import { cn } from "@/lib/utils";

const columns: ColumnDef<TaskFeedbackLogItem>[] = [
  {
    header: "Task",
    accessorKey: "taskTitle",
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p className="font-medium">{row.original.taskTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">Client: {row.original.clientName}</p>
      </div>
    ),
  },
  {
    header: "Employee",
    accessorKey: "employeeName",
    cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
  },
  {
    header: "Task rating",
    accessorKey: "taskRating",
    cell: ({ row }) => <StarRatingDisplay value={row.original.taskRating} />,
  },
  {
    header: "Employee rating",
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

export function TenantTaskFeedbackLogPage() {
  const query = useQuery({
    queryKey: ["tenant-task-feedback-log"],
    queryFn: listTenantTaskFeedbackLog,
    refetchInterval: 30_000,
  });

  if (query.isPending) return <LoadingState label="Loading feedback log" rows={4} />;
  if (query.isError) {
    return (
      <ErrorState title="Feedback log could not load" onRetry={() => void query.refetch()} />
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback log"
        description="Client star ratings on completed tasks after invoice delivery. Timestamps shown in IST."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <ArrowLeft data-icon="inline-start" />
              Dashboard
            </Link>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All client feedback</CardTitle>
          <CardDescription>{items.length} record{items.length === 1 ? "" : "s"} stored permanently.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="No feedback yet"
              description="Feedback appears here when clients rate tasks after receiving an invoice."
            />
          ) : (
            <DataTable
              caption="Tenant client feedback log"
              columns={columns}
              data={items}
              emptyTitle="No feedback yet"
              emptyDescription="Feedback appears when clients rate tasks after invoice delivery."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
