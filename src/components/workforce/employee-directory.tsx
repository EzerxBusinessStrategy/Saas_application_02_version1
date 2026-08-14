"use client";
/* eslint-disable @next/next/no-img-element -- tenant API avatars may use a configured external CDN. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/operations/data-table";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { Pagination } from "@/components/shared/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createTenantAdminEmployee,
  getTenantAdminEmployeeEmailAvailability,
  listTenantAdminEmployeeDirectory,
  listTenantAdminWorkGroups,
  setTenantAdminEmployeeManager,
  updateTenantAdminEmployeeAssignment,
  updateTenantAdminEmployeeCapacity,
} from "@/features/operations/api/operations-api";
import { readFormDraft } from "@/lib/client/form-draft-store";
import type { Employee, EmployeeDirectoryFilters } from "@/types/workforce";

const labelFor = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

function EmployeeIdentity({ employee }: { employee: Employee }) {
  return (
    <div className="flex min-w-44 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {employee.avatarUrl ? (
          <img
            src={employee.avatarUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          initialsFor(employee.name)
        )}
      </span>
      <span>
        <span className="block font-medium">{employee.name}</span>
        <span className="block text-xs text-muted-foreground">
          {employee.code}
        </span>
      </span>
    </div>
  );
}

function ManagerIndicator() {
  return (
    <span
      className="inline-flex text-emerald-600 dark:text-emerald-400"
      role="img"
      aria-label="This employee is a manager"
      title="This employee is a manager"
    >
      <CheckCircle2 className="size-5" aria-hidden="true" />
    </span>
  );
}

function EmployeeCard({
  employee,
  onView,
}: {
  employee: Employee;
  onView: (employee: Employee) => void;
}) {
  return (
    <MobileEntityCard
      title={employee.name}
      identifier={employee.code}
      leading={
        <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {employee.avatarUrl ? (
            <img
              src={employee.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            initialsFor(employee.name)
          )}
        </span>
      }
      status={<StatusBadge status={employee.employmentStatus} />}
      metadata={
        <>
          <div>
            <dt className="text-muted-foreground">Department</dt>
            <dd className="mt-0.5 font-medium">{employee.department}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Manager</dt>
            <dd className="mt-0.5 font-medium">
              {employee.isManager ? (
                <ManagerIndicator />
              ) : (
                employee.manager?.name ?? "Unassigned"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Workload</dt>
            <dd className="mt-0.5">
              <StatusBadge status={employee.workload.risk} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Availability</dt>
            <dd className="mt-0.5">
              <StatusBadge status={employee.availability} />
            </dd>
          </div>
        </>
      }
      primaryAction={
        <Button variant="outline" size="sm" onClick={() => onView(employee)}>
          View
        </Button>
      }
    />
  );
}

function matchesFilters(employee: Employee, filters: EmployeeDirectoryFilters) {
  const query = filters.query?.trim().toLowerCase();
  return (
    (!query ||
      [
        employee.name,
        employee.code,
        employee.department,
        ...employee.categories,
        ...employee.skills,
      ].some((value) => value.toLowerCase().includes(query))) &&
    (!filters.department || employee.department === filters.department) &&
    (!filters.category || employee.categories.includes(filters.category)) &&
    (!filters.managerId || employee.manager?.id === filters.managerId) &&
    (!filters.availability || employee.availability === filters.availability) &&
    (!filters.employmentStatus ||
      employee.employmentStatus === filters.employmentStatus)
  );
}

export function EmployeeDirectory() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [capacityEmployee, setCapacityEmployee] = useState<Employee | null>(null);
  const [assignmentEmployee, setAssignmentEmployee] = useState<Employee | null>(null);
  const appliedSearch = searchParams.get("query") ?? "";
  const [searchValue, setSearchValue] = useState(appliedSearch);
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployeeDirectory,
  });
  const workGroupsQuery = useQuery({
    queryKey: ["tenant-admin-work-groups"],
    queryFn: listTenantAdminWorkGroups,
    enabled: Boolean(assignmentEmployee),
  });
  useEffect(() => {
    if (readFormDraft(`${pathname}:tenant-employee-create`)) {
      setCreateOpen(true);
    }
  }, [pathname]);
  const filters = useMemo<EmployeeDirectoryFilters>(
    () => ({
      query: searchParams.get("query") ?? undefined,
      department: searchParams.get("department") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      managerId: searchParams.get("managerId") ?? undefined,
      availability: searchParams.get(
        "availability",
      ) as EmployeeDirectoryFilters["availability"],
      employmentStatus: searchParams.get(
        "employmentStatus",
      ) as EmployeeDirectoryFilters["employmentStatus"],
    }),
    [searchParams],
  );
  const sort = searchParams.get("sort") === "workload" ? "workload" : "name";
  const requestedPageSize = Number(searchParams.get("pageSize") ?? "5");
  const pageSize = [5, 10, 25, 50].includes(requestedPageSize)
    ? requestedPageSize
    : 5;
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const employees = useMemo<Employee[]>(
    () =>
      (employeesQuery.data?.employees ?? []).map((employee) => ({
        id: employee.id,
        code: employee.employeeCode ?? "-",
        name: employee.name,
        departmentId: employee.departmentId,
        department: employee.departmentName ?? "Unassigned",
        categories: employee.categories,
        skills: employee.skills,
        experienceLevel: employee.experienceLevel,
        manager:
          employee.managerId && employee.managerName
            ? { id: employee.managerId, name: employee.managerName }
            : null,
        workload: { allocatedHours: 0, capacityHours: employee.weeklyCapacityHours, risk: "balanced" },
        utilisationPercent: 0,
        activeTasks: employee.activeTasks,
        availability:
          employee.employmentStatus === "on_leave" ? "unavailable" : "available",
        employmentStatus:
          employee.employmentStatus === "on_leave"
            ? "on-leave"
            : employee.employmentStatus === "inactive"
              ? "inactive"
              : "active",
        workGroups: employee.workGroups,
        isManager: employee.isManager,
      })),
    [employeesQuery],
  );
  const options = useMemo(
    () => ({
      departments: (employeesQuery.data?.departments ?? []).map((department) => department.name),
      categories: [
        ...new Set(employees.flatMap((employee) => employee.categories)),
      ],
      managers: employees.filter((employee) => employee.isManager),
    }),
    [employees, employeesQuery.data?.departments],
  );
  const filteredEmployees = useMemo(
    () =>
      employees
        .filter((employee) => matchesFilters(employee, filters))
        .sort((left, right) =>
          sort === "workload"
            ? right.workload.allocatedHours - left.workload.allocatedHours
            : left.name.localeCompare(right.name),
        ),
    [employees, filters, sort],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const pageEmployees = filteredEmployees.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      value ? next.set(key, value) : next.delete(key);
      if (key !== "page") next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
  useEffect(() => {
    setSearchValue(appliedSearch);
  }, [appliedSearch]);
  useEffect(() => {
    if (searchValue === appliedSearch) return;
    const timeout = window.setTimeout(() => updateParam("query", searchValue), 300);
    return () => window.clearTimeout(timeout);
  }, [appliedSearch, searchValue, updateParam]);
  const clearFilters = () => router.replace(pathname, { scroll: false });
  const openProfile = (employee: Employee) =>
    router.push(`/admin/employees/${employee.id}`);
  const columns: ColumnDef<Employee>[] = [
    {
      id: "employee",
      header: "Employee",
      cell: ({ row }) => <EmployeeIdentity employee={row.original} />,
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => (
        <div className="min-w-32">
          {row.original.department}
          <span className="mt-1 block text-xs text-muted-foreground">
            {row.original.categories.join(", ")}
          </span>
        </div>
      ),
    },
    {
      id: "skills",
      header: "Skills & level",
      cell: ({ row }) => (
        <div className="min-w-36">
          {row.original.skills.length ? (
            row.original.skills.join(", ")
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
          {row.original.experienceLevel ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              {labelFor(row.original.experienceLevel)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "manager",
      header: "Manager",
      cell: ({ row }) => (
        <div className="min-w-32">
          {row.original.isManager ? (
            <ManagerIndicator />
          ) : (
            row.original.manager?.name ?? <span className="text-muted-foreground">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      id: "workload",
      header: "Capacity & utilisation",
      cell: ({ row }) => (
        <div className="min-w-40">
          <span className="block">
            {row.original.workload.allocatedHours}/
            {row.original.workload.capacityHours} hours
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {row.original.utilisationPercent}% utilised ·{" "}
            {row.original.activeTasks} active tasks
          </span>
        </div>
      ),
    },
    {
      id: "availability",
      header: "Availability",
      cell: ({ row }) => <StatusBadge status={row.original.availability} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.employmentStatus} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex min-w-52 items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(row.original.isManager)}
              onChange={async (event) => {
                try {
                  await setTenantAdminEmployeeManager(row.original.id, event.target.checked);
                  await queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] });
                  toast.success(event.target.checked ? "Manager added." : "Manager removed.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Manager role could not be updated.");
                }
              }}
            />
            Manager
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignmentEmployee(row.original)}
          >
            Edit details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCapacityEmployee(row.original)}
          >
            Edit capacity
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openProfile(row.original)}
          >
            View profile
          </Button>
        </div>
      ),
    },
  ];

  if (employeesQuery.isPending) {
    return <LoadingState label="Loading employees" />;
  }

  if (employeesQuery.isError) {
    return (
      <ErrorState
        title="Employees could not load"
        onRetry={() => void employeesQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Workforce"
        title="All employees"
        description="Monitor capability, availability, and work allocation across your tenant."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />Create employee</Button>}
      />
      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Employee directory</CardTitle>
            <CardDescription>
              Search and refine the workforce roster before assigning client
              work.
            </CardDescription>
          </div>
          <FilterToolbar
            search={{
              value: searchValue,
              onChange: setSearchValue,
              label: "Search employees",
              placeholder: "Search name or code",
            }}
            activeFilterCount={activeFilterCount}
            onClear={clearFilters}
            trailing={
              <>
                <label>
                  <span className="sr-only">Sort employees</span>
                  <Select
                    className="w-36"
                    value={sort}
                    onChange={(event) =>
                      updateParam("sort", event.target.value)
                    }
                  >
                    <option value="name">Sort: Name</option>
                    <option value="workload">Sort: Workload</option>
                  </Select>
                </label>
                <span className="hidden whitespace-nowrap text-sm text-muted-foreground xl:inline">
                  {filteredEmployees.length} employees
                </span>
              </>
            }
          >
            <Filter
              label="Department"
              value={filters.department}
              onChange={(value) => updateParam("department", value)}
              options={options.departments}
            />
            <Filter
              label="Category"
              value={filters.category}
              onChange={(value) => updateParam("category", value)}
              options={options.categories}
            />
            <Filter
              label="Manager"
              value={filters.managerId}
              onChange={(value) => updateParam("managerId", value)}
              options={options.managers.map((manager) => manager.id)}
              optionLabel={(id) =>
                employees.find((employee) => employee.id === id)?.name ?? id
              }
            />
            <Filter
              label="Availability"
              value={filters.availability}
              onChange={(value) => updateParam("availability", value)}
              options={["available", "partially-available", "unavailable"]}
              optionLabel={labelFor}
            />
            <Filter
              label="Employment status"
              value={filters.employmentStatus}
              onChange={(value) => updateParam("employmentStatus", value)}
              options={["active", "on-leave", "inactive"]}
              optionLabel={labelFor}
            />
          </FilterToolbar>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <DataTable
              caption="Employees in the active tenant"
              columns={columns}
              data={pageEmployees}
              emptyTitle={
                hasFilters
                  ? "No employees match these filters"
                  : "No employees yet"
              }
              emptyDescription={
                hasFilters
                  ? "Clear or change a filter to broaden the directory."
                  : "Employees will appear here once they are added to this tenant."
              }
            />
          </div>
          <div className="md:hidden">
            {pageEmployees.length ? (
              pageEmployees.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  onView={openProfile}
                />
              ))
            ) : (
              <DataTable
                caption="Employees in the active tenant"
                columns={columns}
                data={pageEmployees}
                emptyTitle={
                  hasFilters
                    ? "No employees match these filters"
                    : "No employees yet"
                }
                emptyDescription={
                  hasFilters
                    ? "Clear or change a filter to broaden the directory."
                    : "Employees will appear here once they are added to this tenant."
                }
              />
            )}
          </div>
          {filteredEmployees.length ? (
            <div className="mt-6">
              <Pagination
                page={currentPage}
                pageCount={totalPages}
                totalItems={filteredEmployees.length}
                pageSize={pageSize}
                onPageChange={(nextPage) =>
                  updateParam("page", String(nextPage))
                }
                onPageSizeChange={(nextPageSize) =>
                  updateParam("pageSize", String(nextPageSize))
                }
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departments={employeesQuery.data?.departments ?? []}
        onCreated={async () => {
          setCreateOpen(false);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] }),
            queryClient.invalidateQueries({ queryKey: ["tenant-admin-departments"] }),
          ]);
        }}
      />
      <CapacityDialog
        employee={capacityEmployee}
        onOpenChange={(open) => !open && setCapacityEmployee(null)}
        onSaved={async (weeklyCapacityHours) => {
          if (!capacityEmployee) return;
          await updateTenantAdminEmployeeCapacity(capacityEmployee.id, weeklyCapacityHours);
          await queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] });
          setCapacityEmployee(null);
          toast.success("Capacity updated.");
        }}
      />
      <AssignmentDialog
        employee={assignmentEmployee}
        managers={options.managers}
        departments={employeesQuery.data?.departments ?? []}
        workGroups={workGroupsQuery.data ?? []}
        onOpenChange={(open) => !open && setAssignmentEmployee(null)}
        onSaved={async (input) => {
          if (!assignmentEmployee) return;
          await updateTenantAdminEmployeeAssignment(assignmentEmployee.id, input);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] }),
            queryClient.invalidateQueries({ queryKey: ["tenant-admin-departments"] }),
          ]);
          setAssignmentEmployee(null);
          toast.success("Employee details updated.");
        }}
      />
    </div>
  );
}

function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
  departments: readonly { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [skills, setSkills] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState("40");
  const [departmentChoice, setDepartmentChoice] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [saving, setSaving] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();
  const canCheckEmail = isValidEmail(normalizedEmail);
  const emailAvailability = useQuery({
    queryKey: ["tenant-admin-employee-email-availability", normalizedEmail],
    queryFn: () => getTenantAdminEmployeeEmailAvailability(normalizedEmail),
    enabled: open && canCheckEmail,
  });
  const emailUnavailable = canCheckEmail && emailAvailability.data?.available === false;
  const emailCheckPending = canCheckEmail && emailAvailability.isFetching;
  const emailCheckFailed = canCheckEmail && emailAvailability.isError;
  const createDisabled =
    saving ||
    !name.trim() ||
    !email.trim() ||
    password.length < 8 ||
    !Number(weeklyCapacityHours) ||
    (departmentChoice === "new" && newDepartmentName.trim().length < 2) ||
    emailUnavailable ||
    emailCheckPending ||
    emailCheckFailed;
  const save = async () => {
    if (!name.trim()) { toast.error("Enter Name."); return; }
    if (!email.trim()) { toast.error("Enter Email."); return; }
    if (password.length < 8) { toast.error("Password must contain at least 8 characters."); return; }
    if (!Number(weeklyCapacityHours)) { toast.error("Enter Weekly capacity hours."); return; }
    if (departmentChoice === "new" && newDepartmentName.trim().length < 2) { toast.error("Enter a department name with at least 2 characters."); return; }
    if (emailUnavailable) { toast.error("Enter a unique Email."); return; }
    if (emailCheckPending) { toast.error("Email availability is still being checked."); return; }
    if (emailCheckFailed) { toast.error("Email availability could not be checked. Try again."); return; }
    if (createDisabled) return;
    setSaving(true);
    try {
      await createTenantAdminEmployee({
        name,
        email,
        password,
        employeeCode,
        isManager,
        skills: skills.split(",").map((value) => value.trim()).filter(Boolean),
        experienceLevel: experienceLevel ? (experienceLevel as "junior" | "mid" | "senior" | "lead") : undefined,
        weeklyCapacityHours: Number(weeklyCapacityHours) || 40,
        departmentId: departmentChoice && departmentChoice !== "new" ? departmentChoice : undefined,
        newDepartmentName: departmentChoice === "new" ? newDepartmentName : undefined,
      });
      toast.success("Employee created.");
      setName("");
      setEmail("");
      setPassword("");
      setEmployeeCode("");
      setSkills("");
      setExperienceLevel("");
      setIsManager(false);
      setWeeklyCapacityHours("40");
      setDepartmentChoice("");
      setNewDepartmentName("");
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee could not be created.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create employee"
        description="Add an active employee to this tenant."
        className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto overscroll-contain"
      >
        <form
          data-draft-key="tenant-employee-create"
          className="grid gap-4 pr-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="text-sm font-medium">Name<Input required data-field-label="Name" name="name" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="text-sm font-medium">Email<Input required data-field-label="Email" name="email" className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {emailUnavailable ? <p className="-mt-3 text-sm text-danger">Email already exists.</p> : null}
          {emailCheckFailed ? <p className="-mt-3 text-sm text-danger">Email availability could not be checked.</p> : null}
          <label className="text-sm font-medium">Password<Input required data-field-label="Password" name="password" className="mt-1" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="text-sm font-medium">Employee code<Input name="employeeCode" className="mt-1" placeholder="Auto-generated if empty" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} /></label>
          <label className="text-sm font-medium">
            Department (optional)
            <Select
              name="departmentId"
              className="mt-1"
              value={departmentChoice}
              onChange={(event) => {
                setDepartmentChoice(event.target.value);
                if (event.target.value !== "new") setNewDepartmentName("");
              }}
            >
              <option value="">Unassigned</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              <option value="new">Create a new department</option>
            </Select>
          </label>
          {departmentChoice === "new" ? (
            <label className="text-sm font-medium">
              New department name
              <Input required data-field-label="New department name" name="newDepartmentName" className="mt-1" value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="For example, Taxation" />
            </label>
          ) : null}
          <label className="text-sm font-medium">Skills (optional)<Input name="skills" className="mt-1" placeholder="GST, Payroll, Compliance" value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
          <label className="text-sm font-medium">Level (optional)<Select name="experienceLevel" className="mt-1" value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}><option value="">Not set</option><option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="lead">Lead</option></Select></label>
          <label className="text-sm font-medium">Weekly capacity hours<Input required data-field-label="Weekly capacity hours" name="weeklyCapacityHours" className="mt-1" type="number" min="1" max="168" value={weeklyCapacityHours} onChange={(event) => setWeeklyCapacityHours(event.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm font-medium"><input name="isManager" type="checkbox" checked={isManager} onChange={(event) => setIsManager(event.target.checked)} />Make this employee a manager</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createDisabled}>{saving ? "Creating..." : "Create employee"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CapacityDialog({
  employee,
  onOpenChange,
  onSaved,
}: {
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (weeklyCapacityHours: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const open = Boolean(employee);
  const currentEmployeeId = employee?.id;
  useEffect(() => {
    setValue(employee ? String(employee.workload.capacityHours) : "");
  }, [employee]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit capacity" description="Update weekly capacity hours." className="max-w-sm">
        <form
          data-draft-key={`tenant-employee-capacity-${currentEmployeeId ?? "new"}`}
          className="grid gap-4 pr-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (currentEmployeeId && Number(value)) void onSaved(Number(value));
          }}
        >
          <label className="text-sm font-medium">Weekly capacity hours<Input name="weeklyCapacityHours" className="mt-1" type="number" min="1" max="168" value={value} onChange={(event) => setValue(event.target.value)} /></label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setValue(""); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={!currentEmployeeId || !Number(value)}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDialog({
  employee,
  managers,
  departments,
  workGroups,
  onOpenChange,
  onSaved,
}: {
  employee: Employee | null;
  managers: readonly Employee[];
  departments: readonly { id: string; name: string }[];
  workGroups: readonly { id: string; name: string; managerEmployeeId: string; status: "active" | "inactive" | "archived" }[];
  onOpenChange: (open: boolean) => void;
  onSaved: (input: {
    skills: string[];
    departmentId: string | null;
    experienceLevel: "junior" | "mid" | "senior" | "lead" | null;
    managerId: string | null;
    workGroupIds: string[];
  }) => Promise<void>;
}) {
  const [skills, setSkills] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [managerId, setManagerId] = useState("");
  const [workGroupIds, setWorkGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const open = Boolean(employee);

  useEffect(() => {
    setSkills(employee?.skills.join(", ") ?? "");
    setDepartmentId(employee?.departmentId ?? "");
    setExperienceLevel(employee?.experienceLevel ?? "");
    setManagerId(employee?.manager?.id ?? "");
    setWorkGroupIds(employee?.workGroups.map((workGroup) => workGroup.id) ?? []);
  }, [employee]);

  const managerWorkGroupIds = workGroups
    .filter((workGroup) => workGroup.managerEmployeeId === employee?.id)
    .map((workGroup) => workGroup.id);
  const toggleWorkGroup = (workGroupId: string, checked: boolean) => {
    if (managerWorkGroupIds.includes(workGroupId)) return;
    setWorkGroupIds((current) =>
      checked
        ? [...new Set([...current, workGroupId])]
        : current.filter((currentId) => currentId !== workGroupId),
    );
  };

  const save = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await onSaved({
        skills: skills.split(",").map((value) => value.trim()).filter(Boolean),
        departmentId: departmentId || null,
        experienceLevel: experienceLevel ? (experienceLevel as "junior" | "mid" | "senior" | "lead") : null,
        managerId: managerId || null,
        workGroupIds,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee details could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit employee details" description="Update department, work groups, skills, level, and reporting manager." className="max-w-md">
        <form
          data-draft-key={`tenant-employee-assignment-${employee?.id ?? "new"}`}
          className="grid gap-4 pr-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Work groups</legend>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-[var(--radius-control)] border border-input bg-muted/20 p-2">
              {workGroups.filter((workGroup) => workGroup.status === "active").length ? workGroups.filter((workGroup) => workGroup.status === "active").map((workGroup) => {
                const managedByEmployee = managerWorkGroupIds.includes(workGroup.id);
                return <label key={workGroup.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" name="workGroupIds" value={workGroup.id} checked={workGroupIds.includes(workGroup.id) || managedByEmployee} disabled={managedByEmployee} onChange={(event) => toggleWorkGroup(workGroup.id, event.target.checked)} />
                  <span className="min-w-0 flex-1 truncate">{workGroup.name}</span>
                  {managedByEmployee ? <span className="text-xs text-muted-foreground">Manager</span> : null}
                </label>;
              }) : <p className="px-2 py-1 text-sm text-muted-foreground">No active work groups are available.</p>}
            </div>
          </fieldset>
          <label className="text-sm font-medium">Department<Select name="departmentId" className="mt-1" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">Unassigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></label>
          <label className="text-sm font-medium">Skills<Input name="skills" className="mt-1" value={skills} placeholder="GST, Payroll, Compliance" onChange={(event) => setSkills(event.target.value)} /></label>
          <label className="text-sm font-medium">Level<Select name="experienceLevel" className="mt-1" value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}><option value="">Not set</option><option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="lead">Lead</option></Select></label>
          <label className="text-sm font-medium">Manager<Select name="managerId" className="mt-1" value={managerId} onChange={(event) => setManagerId(event.target.value)}><option value="">Unassigned</option>{managers.filter((manager) => manager.id !== employee?.id).map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</Select></label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  optionLabel = labelFor,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  optionLabel?: (value: string) => string;
}) {
  return (
    <label>
      <span className="sr-only">Filter by {label.toLowerCase()}</span>
      <Select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{label}: All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
