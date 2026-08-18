"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { listClients } from "@/features/administration/api/administration-api";
import { listTenantAdminEmployees } from "@/features/operations/api/operations-api";
import {
  listTenantTaskFeedbackLog,
  type TaskFeedbackLogItem,
} from "@/features/client-portal/api/task-feedback-api";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchableFilterSelect } from "@/components/shared/searchable-filter-select";
import { StarRatingDisplay } from "@/components/shared/star-rating";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/shared/date-picker";
import { Select } from "@/components/ui/select";
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
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.status === "expired" ? "No response" : "Submitted"}
      </span>
    ),
  },
  {
    header: "Recorded (IST)",
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">{formatIndiaTimestamp(row.original.createdAt)}</span>
    ),
  },
];

export function TenantTaskFeedbackLogPage() {
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const request = useMemo(
    () => ({
      status: status ? (status as "submitted" | "expired") : undefined,
      from: from || undefined,
      to: to || undefined,
      employeeId: employeeId || undefined,
      clientId: clientId || undefined,
      page,
      pageSize,
    }),
    [clientId, employeeId, from, page, pageSize, status, to],
  );

  const query = useQuery({
    queryKey: ["tenant-task-feedback-log", request],
    queryFn: () => listTenantTaskFeedbackLog(request),
    refetchInterval: 30_000,
  });

  const clientsQuery = useQuery({
    queryKey: ["tenant-feedback-log-clients"],
    queryFn: () => listClients({ page: 1, pageSize: 100 }),
  });

  const employeesQuery = useQuery({
    queryKey: ["tenant-feedback-log-employees"],
    queryFn: listTenantAdminEmployees,
  });

  const activeFilterCount = [status, from, to, employeeId, clientId].filter(Boolean).length;

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
        description="Client star ratings on completed tasks after invoice delivery. Unanswered reviews are recorded automatically after 60 days. Timestamps shown in IST."
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
          <CardDescription>
            {query.data?.total ?? 0} record{(query.data?.total ?? 0) === 1 ? "" : "s"} stored permanently.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FilterToolbar
            filterGridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            activeFilterCount={activeFilterCount}
            onClear={() => {
              setStatus("");
              setFrom("");
              setTo("");
              setEmployeeId("");
              setClientId("");
              setPage(1);
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <Select
                aria-label="Filter feedback status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All feedback</option>
                <option value="submitted">Submitted</option>
                <option value="expired">No response</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              From date
              <DatePicker
                aria-label="Filter from date"
                value={from}
                onChange={(value) => {
                  setFrom(value);
                  setPage(1);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              To date
              <DatePicker
                aria-label="Filter to date"
                value={to}
                onChange={(value) => {
                  setTo(value);
                  setPage(1);
                }}
              />
            </label>
            <SearchableFilterSelect
              label="Employee"
              ariaLabel="Filter by employee"
              value={employeeId}
              onChange={(value) => {
                setEmployeeId(value);
                setPage(1);
              }}
              options={(employeesQuery.data ?? []).map((employee) => ({
                id: employee.id,
                name: employee.employeeCode
                  ? `${employee.name} (${employee.employeeCode})`
                  : employee.name,
              }))}
              emptyLabel="All employees"
              placeholder="Search employees..."
            />
            <SearchableFilterSelect
              label="Client"
              ariaLabel="Filter by client"
              value={clientId}
              onChange={(value) => {
                setClientId(value);
                setPage(1);
              }}
              options={(clientsQuery.data?.items ?? []).map((client) => ({
                id: client.id,
                name: client.name,
              }))}
              emptyLabel="All clients"
              placeholder="Search clients..."
            />
          </FilterToolbar>

          {items.length === 0 ? (
            <EmptyState
              title="No feedback yet"
              description="Feedback appears here when clients rate tasks after receiving an invoice."
            />
          ) : (
            <>
              <DataTable
                caption="Tenant client feedback log"
                columns={columns}
                data={items}
                emptyTitle="No feedback yet"
                emptyDescription="Feedback appears when clients rate tasks after invoice delivery."
              />
              <Pagination
                page={query.data?.page ?? page}
                pageCount={query.data?.pageCount ?? 1}
                totalItems={query.data?.total ?? 0}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(value) => {
                  setPageSize(value);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
