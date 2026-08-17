"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  listTenantAdminOpenTasks,
  type OpenTask,
} from "@/features/tenant-admin/api/open-tasks-api";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatDateTime(value: string | null): string {
  if (!value) return "Not set";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "MMM d, yyyy h:mm a");
}

function formatIsoDate(value: string): string {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy");
}

function humanise(value: string): string {
  return value.replaceAll("_", " ");
}

function taskStatusTone(status: string): "neutral" | "info" | "warning" | "success" | "danger" {
  if (["completed", "approved"].includes(status)) return "success";
  if (["returned", "cancelled"].includes(status)) return "danger";
  if (["manager_review", "tenant_approval", "submitted"].includes(status)) return "warning";
  if (["in_progress", "assigned", "open"].includes(status)) return "info";
  return "neutral";
}

function assigneeSummary(task: OpenTask): string {
  if (task.assignees.length === 0) {
    return task.workGroupName ? `Work group: ${task.workGroupName}` : "Unassigned";
  }
  return task.assignees.map((assignee) => assignee.name).join(", ");
}

const columns: ColumnDef<OpenTask>[] = [
  {
    header: "Task",
    accessorKey: "title",
    cell: ({ row }) => (
      <div className="min-w-[220px]">
        <p className="font-medium">{row.original.title}</p>
        {row.original.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.original.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">{row.original.serviceName}</p>
      </div>
    ),
  },
  {
    header: "Client",
    accessorKey: "clientName",
    cell: ({ row }) => (
      <div className="min-w-[160px]">
        <p className="font-medium">{row.original.clientName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          IP: {row.original.clientPublicIp ?? "Not recorded"}
        </p>
      </div>
    ),
  },
  {
    header: "Assigned to",
    id: "assignees",
    cell: ({ row }) => (
      <div className="min-w-[180px]">
        <p>{assigneeSummary(row.original)}</p>
        {row.original.assignees.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {row.original.assignees.map((assignee) => (
              <li key={assignee.id}>
                {assignee.name} · {formatDateTime(assignee.assignedAt)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    ),
  },
  {
    header: "Due date",
    accessorKey: "plannedDueAt",
    cell: ({ row }) => formatDateTime(row.original.plannedDueAt),
  },
  {
    header: "Assigned",
    accessorKey: "assignedAt",
    cell: ({ row }) => formatDateTime(row.original.assignedAt),
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge tone={taskStatusTone(row.original.status)}>{humanise(row.original.status)}</Badge>
    ),
  },
  {
    header: "Priority",
    accessorKey: "priority",
    cell: ({ row }) => <span className="capitalize">{humanise(row.original.priority)}</span>,
  },
];

export function OpenTasksPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const query = useQuery({
    queryKey: ["tenant-admin-open-tasks", from ?? "", to ?? ""],
    queryFn: () => listTenantAdminOpenTasks({ from, to }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const periodLabel = useMemo(() => {
    if (!query.data) return "";
    const { period } = query.data;
    if (period.source === "financial_year") return "current financial year";
    if (period.source === "last_30_days") return "last 30 days";
    return "selected date range";
  }, [query.data]);

  if (query.isPending) return <LoadingState label="Loading open tasks" rows={8} />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Open tasks could not load"
        description="The task list for this period could not be retrieved."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { period, tasks, total } = query.data;
  const backHref =
    from && to ? `/admin?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "/admin";

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Open tasks"
        description={`Showing ${formatIsoDate(period.from)} – ${formatIsoDate(period.to)} (${periodLabel}). Tasks that are not completed or cancelled, due or created in this period.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={backHref}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to overview
            </Link>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{total} open task{total === 1 ? "" : "s"}</CardTitle>
          <CardDescription>
            Client public IP is the latest known address from client portal sign-in (session or successful login).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState
              title="No open tasks in this period"
              description="Adjust the date range on the operations overview or check back when work is scheduled."
            />
          ) : (
            <DataTable
              caption="Open tasks for the selected period"
              columns={columns}
              data={tasks}
              emptyTitle="No open tasks"
              emptyDescription="No matching tasks were found."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
