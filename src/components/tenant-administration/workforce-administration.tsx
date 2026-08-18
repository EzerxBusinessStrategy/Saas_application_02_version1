"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/operations/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityHeader } from "@/components/shared/entity-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listTenantAdminEmployeeDirectory,
  listTenantAdminTasks,
  listTenantAdminWorkGroups,
  setTenantAdminEmployeeManager,
  type TenantAdminEmployeeOption,
  type TenantAdminTask,
} from "@/features/operations/api/operations-api";
import { tenantTaskReviewHref } from "@/features/operations/tenant-admin-task-map";
import { readFormDraft } from "@/lib/client/form-draft-store";
import { cn } from "@/lib/utils";

const employeeTabs = [
  { value: "overview", label: "Overview" },
  { value: "skills", label: "Skills" },
  { value: "tasks", label: "Tasks" },
];

export function EmployeeProfile({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const usesDatabaseEmployeeId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      employeeId,
    );
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployeeDirectory,
    enabled: usesDatabaseEmployeeId,
  });
  const employeeRecord = (employeesQuery.data?.employees ?? []).find(
    (item) => item.id === employeeId,
  );
  if (!usesDatabaseEmployeeId) {
    return (
      <EmptyState
        title="Employee not found"
        description="This profile address is invalid."
      />
    );
  }
  if (usesDatabaseEmployeeId && employeesQuery.isPending) {
    return <LoadingState label="Loading employee profile" rows={3} />;
  }
  if (usesDatabaseEmployeeId && employeesQuery.isError) {
    return (
      <ErrorState
        title="Employee profile could not load"
        onRetry={() => void employeesQuery.refetch()}
      />
    );
  }
  if (!employeeRecord)
    return (
      <EmptyState
        title="Employee not found"
        description="This profile is unavailable or the address is incorrect."
      />
    );
  const employee = employeeRecord;
  const employmentBadgeStatus =
    employee.employmentStatus === "on_leave"
      ? "on-leave"
      : employee.employmentStatus === "inactive"
        ? "inactive"
        : "active";
  const panel =
    tab === "overview" ? (
      <section className="grid gap-[30px] lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Weekly capacity: {employee.weeklyCapacityHours} hours.
            </p>
            <p className="text-sm text-muted-foreground">
              {employee.activeTasks} active tasks.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={employmentBadgeStatus} />
            <p className="mt-3 text-sm text-muted-foreground">
              Employment status:{" "}
              {employee.employmentStatus.replaceAll("_", " ")}.
            </p>
          </CardContent>
        </Card>
      </section>
    ) : tab === "skills" ? (
      <Card>
        <CardHeader>
          <CardTitle>Skills and experience</CardTitle>
        </CardHeader>
        <CardContent>
          {employee.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {employee.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-[var(--radius-control)] border border-border bg-muted px-3 py-1.5 text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No skills have been added for this employee.
            </p>
          )}
          {employee.experienceLevel ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Experience level: {employee.experienceLevel}
            </p>
          ) : null}
        </CardContent>
      </Card>
    ) : tab === "tasks" ? (
      <EmployeeTasksPanel employee={employee} allEmployees={employeesQuery.data?.employees ?? []} />
    ) : null;
  return (
    <div className="flex flex-col gap-[30px]">
      <EntityHeader
        eyebrow="Workforce"
        title={employee.name}
        description={`${employee.employeeCode ?? "Not assigned"} · ${employee.departmentName ?? "Not assigned"}`}
        metadata={
          <>
            <StatusBadge status={employmentBadgeStatus} />
            {employee.email ? <span>{employee.email}</span> : null}
            <span>{employee.activeTasks} active tasks</span>
          </>
        }
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/admin/employees")}
          >
            Back to employees
          </Button>
        }
      />
      <ResponsiveTabs
        tabs={employeeTabs}
        value={tab}
        onValueChange={setTab}
        label="Employee profile sections"
      >
        {panel}
      </ResponsiveTabs>
    </div>
  );
}

export function ManagerDirectory() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployeeDirectory,
  });
  const employees = employeesQuery.data?.employees ?? [];
  useEffect(() => {
    if (readFormDraft(`${pathname}:tenant-add-manager`)) setAddOpen(true);
  }, [pathname]);
  const managers = employees.filter((employee) => employee.isManager);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] });
  const removeManager = async (employee: TenantAdminEmployeeOption) => {
    try {
      await setTenantAdminEmployeeManager(employee.id, false);
      await refresh();
      toast.success("Manager access disabled. The employee has been notified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manager could not be removed.");
    }
  };
  if (employeesQuery.isPending)
    return <LoadingState label="Loading managers" rows={3} />;
  if (employeesQuery.isError)
    return (
      <ErrorState
        title="Manager directory could not load"
        onRetry={() => void employeesQuery.refetch()}
      />
    );
  const columns: ColumnDef<TenantAdminEmployeeOption>[] = [
    { accessorKey: "name", header: "Manager" },
    { accessorKey: "employeeCode", header: "Employee code" },
    { id: "status", header: "Status", cell: () => <StatusBadge status="active" /> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/admin/employees/${row.original.id}`)}>
            View
          </Button>
          <Button variant="outline" size="sm" onClick={() => void removeManager(row.original)}>
            Disable manager
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Workforce"
        title="Managers"
        description="Select employees who can review assigned work."
        actions={<Button onClick={() => setAddOpen(true)}><Plus data-icon="inline-start" />Add manager</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Manager directory</CardTitle>
          <CardDescription>
            Managers are active employees with the Manager role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <DataTable
              caption="Managers in the active tenant"
              columns={columns}
              data={managers}
              emptyTitle="No managers"
              emptyDescription="Add a manager from the active employee list."
            />
          </div>
          <div className="md:hidden">
            {managers.map((manager) => (
              <MobileEntityCard
                key={manager.id}
                title={manager.name}
                identifier={manager.employeeCode ?? "No employee code"}
                status={<StatusBadge status="active" />}
                metadata={
                  <>
                    <div>
                      <dt className="text-muted-foreground">Role</dt>
                      <dd className="mt-0.5">Manager</dd>
                    </div>
                  </>
                }
                primaryAction={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(`/admin/employees/${manager.id}`)
                    }
                  >
                    View
                  </Button>
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <AddManagerDialog
        employees={employees.filter((employee) => !employee.isManager)}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={async () => {
          setAddOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

function EmployeeTasksPanel({
  employee,
  allEmployees,
}: {
  employee: TenantAdminEmployeeOption;
  allEmployees: TenantAdminEmployeeOption[];
}) {
  const tasksQuery = useQuery({
    queryKey: ["tenant-admin-employee-tasks", employee.id],
    queryFn: () => listTenantAdminTasks(),
  });
  const workGroupsQuery = useQuery({
    queryKey: ["tenant-admin-work-groups"],
    queryFn: listTenantAdminWorkGroups,
    enabled: employee.isManager,
  });

  const relevantEmployeeIds = useMemo(() => {
    const ids = new Set<string>([employee.id]);
    if (employee.isManager) {
      for (const member of allEmployees) {
        if (member.managerId === employee.id) ids.add(member.id);
      }
      for (const workGroup of workGroupsQuery.data ?? []) {
        if (workGroup.managerEmployeeId !== employee.id) continue;
        for (const member of workGroup.members) ids.add(member.id);
      }
    }
    return ids;
  }, [allEmployees, employee.id, employee.isManager, workGroupsQuery.data]);

  const assignedTasks = useMemo(() => {
    return (tasksQuery.data ?? []).filter((task) =>
      task.assignees.some((assignee) => relevantEmployeeIds.has(assignee.id)),
    );
  }, [relevantEmployeeIds, tasksQuery.data]);

  const columns: ColumnDef<TenantAdminTask>[] = [
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    { accessorKey: "clientName", header: "Client" },
    { accessorKey: "serviceName", header: "Service" },
    {
      id: "assignees",
      header: "Assigned to",
      cell: ({ row }) =>
        row.original.assignees.length
          ? row.original.assignees.map((assignee) => assignee.name).join(", ")
          : "Unassigned",
    },
    {
      id: "due",
      header: "Due",
      cell: ({ row }) =>
        row.original.plannedDueAt
          ? new Intl.DateTimeFormat(undefined, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date(row.original.plannedDueAt))
          : "No due date",
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.priority.replaceAll("_", " ")}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge tone={taskStatusTone(row.original.status)} className="capitalize">
          {row.original.status.replaceAll("_", " ")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link
          href={tenantTaskReviewHref(row.original.id)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Open
        </Link>
      ),
    },
  ];

  if (tasksQuery.isPending) return <LoadingState label="Loading assigned tasks" rows={4} />;
  if (tasksQuery.isError) {
    return (
      <ErrorState
        title="Assigned tasks could not load"
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  }

  const openTasks = assignedTasks.filter((task) => !["completed", "cancelled", "approved"].includes(task.status));
  const completedTasks = assignedTasks.filter((task) => ["completed", "approved"].includes(task.status));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned tasks</CardTitle>
        <CardDescription>
          {employee.isManager
            ? `Tasks allotted to ${employee.name} and employees in their team (${openTasks.length} open, ${completedTasks.length} completed).`
            : `Tasks allotted to ${employee.name} (${openTasks.length} open, ${completedTasks.length} completed).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          caption={`Tasks assigned to ${employee.name}`}
          columns={columns}
          data={assignedTasks}
          emptyTitle="No assigned tasks"
          emptyDescription={
            employee.isManager
              ? "Tasks assigned to this manager or their team members will appear here."
              : "Tasks assigned to this employee will appear here."
          }
        />
      </CardContent>
    </Card>
  );
}

function taskStatusTone(
  status: TenantAdminTask["status"],
): "neutral" | "info" | "warning" | "success" | "danger" {
  if (["completed", "approved"].includes(status)) return "success";
  if (["cancelled", "returned"].includes(status)) return "danger";
  if (["in_progress", "manager_review", "tenant_approval"].includes(status)) return "warning";
  if (["assigned", "open", "requested"].includes(status)) return "info";
  return "neutral";
}

function AddManagerDialog({
  employees,
  open,
  onOpenChange,
  onAdded,
}: {
  employees: TenantAdminEmployeeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!employeeId) return;
    setSaving(true);
    try {
      await setTenantAdminEmployeeManager(employeeId, true);
      toast.success("Manager access enabled. The employee has been notified.");
      await onAdded();
      setEmployeeId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manager could not be added.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Enable manager access" description="Select an active employee to grant manager access." className="max-w-md">
        <form
          data-draft-key="tenant-add-manager"
          className="grid gap-4 pr-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="text-sm font-medium">Employee<Select name="employeeId" className="mt-1" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select></label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!employeeId || saving}>{saving ? "Saving..." : "Enable manager"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
