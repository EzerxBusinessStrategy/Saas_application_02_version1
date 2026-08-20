"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/operations/data-table";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createTenantAdminDepartment,
  listTenantAdminDepartments,
  updateTenantAdminEmployeeAssignment,
  type TenantAdminDepartment,
} from "@/features/operations/api/operations-api";

export function DepartmentDirectory() {
  const queryClient = useQueryClient();
  const departmentsQuery = useQuery({
    queryKey: ["tenant-admin-departments"],
    queryFn: listTenantAdminDepartments,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<TenantAdminDepartment | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const employees = useMemo(
    () => departmentsQuery.data?.employees ?? [],
    [departmentsQuery.data?.employees],
  );
  const employeesByDepartment = useMemo(() => {
    const groups = new Map<string, typeof employees>();
    for (const employee of employees) {
      if (!employee.departmentId) continue;
      const current = groups.get(employee.departmentId) ?? [];
      current.push(employee);
      groups.set(employee.departmentId, current);
    }
    return groups;
  }, [employees]);
  const availableEmployees = employees.filter(
    (employee) => employee.employmentStatus === "active" && employee.departmentId !== selectedDepartment?.id,
  );
  const filteredDepartments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (departmentsQuery.data?.departments ?? []).filter((department) => {
      if (statusFilter !== "all" && department.status !== statusFilter) return false;
      if (!needle) return true;
      if (department.name.toLowerCase().includes(needle)) return true;
      const departmentEmployees = employeesByDepartment.get(department.id) ?? [];
      return departmentEmployees.some((employee) =>
        [employee.name, employee.employeeCode ?? ""].join(" ").toLowerCase().includes(needle),
      );
    });
  }, [departmentsQuery.data?.departments, employeesByDepartment, search, statusFilter]);
  const activeFilterCount = (search.trim() ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant-admin-departments"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] }),
    ]);
  };
  const columns: ColumnDef<TenantAdminDepartment>[] = [
    {
      accessorKey: "name",
      header: "Department",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: "employeeCount", header: "Active employees" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={row.original.status !== "active"}
          onClick={() => {
            setEmployeeId("");
            setSelectedDepartment(row.original);
          }}
        >
          Manage employees
        </Button>
      ),
    },
  ];

  if (departmentsQuery.isPending) return <LoadingState label="Loading departments" rows={4} />;
  if (departmentsQuery.isError) {
    return <ErrorState title="Departments could not load" onRetry={() => void departmentsQuery.refetch()} />;
  }

  const selectedEmployees = selectedDepartment
    ? employeesByDepartment.get(selectedDepartment.id) ?? []
    : [];
  const assignEmployee = async () => {
    if (!selectedDepartment || !employeeId) {
      toast.error("Choose an employee to add to this department.");
      return;
    }
    setSaving(true);
    try {
      await updateTenantAdminEmployeeAssignment(employeeId, { departmentId: selectedDepartment.id });
      await refresh();
      setEmployeeId("");
      toast.success("Employee assigned to department.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee could not be assigned to this department.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People and teams"
        title="Departments"
        description="Create departments and keep each employee assigned to the correct team."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Create department
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Department directory</CardTitle>
          <CardDescription>Employee counts and assignments for each department.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterToolbar
            activeFilterCount={activeFilterCount}
            onClear={() => {
              setSearch("");
              setStatusFilter("all");
            }}
          >
            <label className="text-sm font-medium sm:col-span-2">
              Search
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search department or employee"
                  aria-label="Search departments and employees"
                />
              </div>
            </label>
            <label className="text-sm font-medium">
              Status
              <Select
                className="mt-1"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
                aria-label="Filter departments by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
          </FilterToolbar>
          <DataTable
            caption="Departments in the active tenant"
            columns={columns}
            data={filteredDepartments}
            emptyTitle={search.trim() || statusFilter !== "all" ? "No matching departments" : "No departments yet"}
            emptyDescription={
              search.trim() || statusFilter !== "all"
                ? "Try another search term or clear the filters."
                : "Create a department here or enter a new department while creating an employee."
            }
          />
        </CardContent>
      </Card>
      <CreateDepartmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          await refresh();
          setCreateOpen(false);
        }}
      />
      <Dialog open={Boolean(selectedDepartment)} onOpenChange={(open) => !open && setSelectedDepartment(null)}>
        <DialogContent
          title={selectedDepartment ? `Manage ${selectedDepartment.name}` : "Manage department"}
          description="Assign active employees to this department. Reassigning an employee updates their workforce record immediately."
          className="max-w-lg"
        >
          <div className="grid gap-5 pr-8">
            <div>
              <p className="text-sm font-medium">Current employees</p>
              {selectedEmployees.length ? (
                <ul className="mt-2 divide-y rounded-[var(--radius-control)] border">
                  {selectedEmployees.map((employee) => (
                    <li key={employee.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium">{employee.name}</span>
                      <span className="truncate text-muted-foreground">{employee.employeeCode ?? "-"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No active employees are assigned yet.</p>
              )}
            </div>
            <label className="text-sm font-medium">
              Add employee
              <Select className="mt-1.5" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Select an employee</option>
                {availableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}{employee.departmentName ? ` - currently ${employee.departmentName}` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedDepartment(null)}>Close</Button>
              <Button type="button" disabled={saving || !employeeId} onClick={() => void assignEmployee()}>
                {saving ? "Assigning..." : "Add employee"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateDepartmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Enter a department name with at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      await createTenantAdminDepartment({ name });
      setName("");
      await onCreated();
      toast.success("Department created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Department could not be created.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create department" description="Create a department for the active tenant." className="max-w-md">
        <form
          className="grid gap-4 pr-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="text-sm font-medium">
            Department name
            <Input required className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Taxation" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create department"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
