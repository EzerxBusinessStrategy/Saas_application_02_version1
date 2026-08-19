"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  listTenantAdminAllocatedWork,
  type AllocatedWorkStatusGroup,
  type AllocatedWorkTask,
} from "@/features/tenant-admin/api/open-tasks-api";
import { listTenantAdminTaskOptions } from "@/features/operations/api/operations-api";
import { mapAllocatedWorkToOperationalTask } from "@/features/operations/tenant-admin-task-map";
import {
  parseAllocatedWorkFilters,
  serializeAllocatedWorkFilters,
  type AllocatedWorkPageFilters,
} from "@/components/tenant-administration/allocated-work-filters";
import { DataTable } from "@/components/operations/data-table";
import { TaskDetailsDrawer } from "@/components/operations/task-details-drawer";
import { DatePicker } from "@/components/shared/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchableFilterSelect } from "@/components/shared/searchable-filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { OperationalTask } from "@/types/operations";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "MMM d, yyyy h:mm a");
}

function formatIp(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not recorded";
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

function assigneeSummary(task: AllocatedWorkTask): string {
  if (task.assignees.length === 0) {
    return task.workGroupName ? `Work group: ${task.workGroupName}` : "Unassigned";
  }
  return task.assignees.map((assignee) => assignee.name).join(", ");
}

const columns: ColumnDef<AllocatedWorkTask>[] = [
  {
    header: "Client",
    accessorKey: "clientName",
    cell: ({ row }) => <p className="min-w-[140px] font-medium">{row.original.clientName}</p>,
  },
  {
    header: "Assigned employee",
    id: "assignees",
    cell: ({ row }) => <p className="min-w-[160px]">{assigneeSummary(row.original)}</p>,
  },
  {
    header: "Assigned",
    accessorKey: "assignedAt",
    cell: ({ row }) => formatDateTime(row.original.assignedAt ?? row.original.assignees[0]?.assignedAt),
  },
  {
    header: "Due",
    accessorKey: "plannedDueAt",
    cell: ({ row }) => formatDateTime(row.original.plannedDueAt),
  },
  {
    header: "Client IP",
    id: "clientPublicIp",
    cell: ({ row }) => <p className="min-w-[120px] font-mono text-xs">{formatIp(row.original.clientPublicIp)}</p>,
  },
  {
    header: "Employee IP",
    id: "employeePublicIp",
    cell: ({ row }) => <p className="min-w-[120px] font-mono text-xs">{formatIp(row.original.employeePublicIp)}</p>,
  },
  {
    header: "Service",
    accessorKey: "serviceName",
    cell: ({ row }) => <p className="min-w-[140px]">{row.original.serviceName}</p>,
  },
  {
    header: "Task",
    accessorKey: "title",
    cell: ({ row }) => (
      <div className="min-w-[200px]">
        <p className="font-medium">{row.original.title}</p>
        {row.original.atRisk ? (
          <p className="mt-1 text-xs text-destructive">{row.original.atRiskReasons.join(" ")}</p>
        ) : null}
      </div>
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge tone={taskStatusTone(row.original.status)}>{humanise(row.original.status)}</Badge>
    ),
  },
];

function headingForStatus(status: AllocatedWorkStatusGroup): { title: string; description: string } {
  switch (status) {
    case "open":
      return {
        title: "Open tasks",
        description:
          "Design status: Pending Figma verification. Tasks that are not completed or cancelled in the selected period.",
      };
    case "completed":
      return {
        title: "Completed tasks",
        description:
          "Design status: Pending Figma verification. Tasks completed in the selected period, with client, assignment, due date, employee, and IP details.",
      };
    case "overdue":
      return {
        title: "Overdue tasks",
        description:
          "Design status: Pending Figma verification. Open tasks whose due date has passed, with client, assignment, due date, employee, and IP details.",
      };
    case "all":
    case "in_progress":
    case "review":
      return {
        title: "Allocated work",
        description:
          "Design status: Pending Figma verification. Client, assigned employee, assignment time, due time, and IP details for allotted tasks.",
      };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function AllocatedWorkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = parseAllocatedWorkFilters(searchParams);
  const [selected, setSelected] = useState<OperationalTask | null>(null);

  function commitFilters(next: Partial<AllocatedWorkPageFilters>) {
    const query = serializeAllocatedWorkFilters({ ...filters, ...next });
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const dueRange = filters.from && filters.to ? { from: filters.from, to: filters.to } : {};
  const query = useQuery({
    queryKey: [
      "tenant-admin-allocated-work",
      filters.clientId,
      filters.employeeId,
      filters.serviceId,
      filters.status,
      filters.from,
      filters.to,
      filters.atRisk,
      filters.range,
    ],
    queryFn: () =>
      listTenantAdminAllocatedWork({
        clientId: filters.clientId || undefined,
        employeeId: filters.employeeId || undefined,
        serviceId: filters.serviceId || undefined,
        status: filters.status,
        atRisk: filters.atRisk || undefined,
        range: filters.from && filters.to ? filters.range : undefined,
        ...dueRange,
      }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const optionsQuery = useQuery({
    queryKey: ["tenant-admin-task-options"],
    queryFn: listTenantAdminTaskOptions,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.clientId) count += 1;
    if (filters.employeeId) count += 1;
    if (filters.serviceId) count += 1;
    if (filters.status !== "all") count += 1;
    if (filters.from && filters.to) count += 1;
    if (filters.atRisk) count += 1;
    return count;
  }, [filters]);

  if (query.isPending) return <LoadingState label="Loading allocated work" rows={8} />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Allocated work could not load"
        description="The assigned task register could not be retrieved."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { tasks, total } = query.data;
  const heading = headingForStatus(filters.status);
  const dateLabel = filters.range === "kpi" ? "Period" : "Due";

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant administration"
        title={heading.title}
        description={heading.description}
        actions={
          <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {total} task{total === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            Open a row to see task details. At-risk work is overdue or has a near-breach / breached SLA.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FilterToolbar
            activeFilterCount={activeFilterCount}
            onClear={() => router.replace(pathname, { scroll: false })}
            filterGridClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <SearchableFilterSelect
              label="Client"
              ariaLabel="Filter by client"
              value={filters.clientId}
              onChange={(clientId) => commitFilters({ clientId })}
              options={optionsQuery.data?.clients ?? []}
              emptyLabel="All clients"
              disabled={optionsQuery.isPending}
            />
            <SearchableFilterSelect
              label="Employee"
              ariaLabel="Filter by assigned employee"
              value={filters.employeeId}
              onChange={(employeeId) => commitFilters({ employeeId })}
              options={optionsQuery.data?.employees ?? []}
              emptyLabel="All employees"
              disabled={optionsQuery.isPending}
            />
            <SearchableFilterSelect
              label="Service"
              ariaLabel="Filter by service"
              value={filters.serviceId}
              onChange={(serviceId) => commitFilters({ serviceId })}
              options={optionsQuery.data?.services ?? []}
              emptyLabel="All services"
              disabled={optionsQuery.isPending}
            />
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Status
              <Select
                value={filters.status}
                onChange={(event) => commitFilters({ status: event.target.value as AllocatedWorkStatusGroup })}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {dateLabel} from
              <DatePicker
                value={filters.from}
                onChange={(from) => commitFilters({ from, range: "due" })}
                aria-label={`${dateLabel} from`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {dateLabel} to
              <DatePicker
                value={filters.to}
                onChange={(to) => commitFilters({ to, range: "due" })}
                aria-label={`${dateLabel} to`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={filters.atRisk}
                onChange={(event) => commitFilters({ atRisk: event.target.checked })}
              />
              At risk only
            </label>
          </FilterToolbar>

          {tasks.length === 0 ? (
            <EmptyState
              title="No matching tasks"
              description="Accepted requests create tasks here after an employee is allotted."
            />
          ) : (
            <DataTable
              caption={heading.title}
              columns={columns}
              data={tasks}
              emptyTitle="No allocated work"
              emptyDescription="No matching tasks were found."
              onRowClick={(task) => setSelected(mapAllocatedWorkToOperationalTask(task))}
            />
          )}
        </CardContent>
      </Card>

      <TaskDetailsDrawer
        task={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        workLogs={[]}
        canUpdate={false}
        onUpdate={() => undefined}
      />
    </div>
  );
}
