"use client";
/* eslint-disable @next/next/no-img-element -- tenant API avatars may use a configured external CDN. */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
  listTenantAdminEmployees,
  setTenantAdminEmployeeManager,
  updateTenantAdminEmployeeCapacity,
} from "@/features/operations/api/operations-api";
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
              {employee.manager?.name ?? "Unassigned"}
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
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployees,
  });
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
      (employeesQuery.data ?? []).map((employee) => ({
        id: employee.id,
        code: employee.employeeCode ?? "-",
        name: employee.name,
        department: "Unassigned",
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
      departments: [
        ...new Set(employees.map((employee) => employee.department)),
      ],
      categories: [
        ...new Set(employees.flatMap((employee) => employee.categories)),
      ],
      managers: employees.filter(
        (employee) =>
          employee.manager === null ||
          employees.some((candidate) => candidate.manager?.id === employee.id),
      ),
    }),
    [employees],
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

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  };
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
        <span>
          {row.original.department}
          <span className="mt-1 block text-xs text-muted-foreground">
            {row.original.categories.join(", ")}
          </span>
        </span>
      ),
    },
    {
      id: "skills",
      header: "Skills & level",
      cell: ({ row }) => (
        <span>
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
        </span>
      ),
    },
    {
      id: "manager",
      header: "Manager",
      cell: ({ row }) =>
        row.original.manager?.name ?? (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      id: "workload",
      header: "Capacity & utilisation",
      cell: ({ row }) => (
        <span>
          <span className="block">
            {row.original.workload.allocatedHours}/
            {row.original.workload.capacityHours} hours
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {row.original.utilisationPercent}% utilised ·{" "}
            {row.original.activeTasks} active tasks
          </span>
          <Button className="mt-2 h-7 px-2 text-xs" variant="outline" size="sm" onClick={() => setCapacityEmployee(row.original)}>
            Edit
          </Button>
        </span>
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
        <div className="flex items-center gap-3">
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
            onClick={() => openProfile(row.original)}
          >
            View profile
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-[30px]">
      {employeesQuery.isPending ? <LoadingState label="Loading employees" rows={4} /> : null}
      {employeesQuery.isError ? <ErrorState title="Employees could not load" onRetry={() => void employeesQuery.refetch()} /> : null}
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
              value: filters.query ?? "",
              onChange: (value) => updateParam("query", value),
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
        onCreated={async () => {
          setCreateOpen(false);
          await queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] });
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
    </div>
  );
}

function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [skills, setSkills] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState("40");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) return;
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
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Employee could not be created.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create employee" description="Add an active employee to this tenant." className="max-w-md">
        <div className="grid gap-4 pr-8">
          <label className="text-sm font-medium">Name<Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="text-sm font-medium">Email<Input className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="text-sm font-medium">Password<Input className="mt-1" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="text-sm font-medium">Employee code<Input className="mt-1" placeholder="Auto-generated if empty" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} /></label>
          <label className="text-sm font-medium">Skills (optional)<Input className="mt-1" placeholder="GST, Payroll, Compliance" value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
          <label className="text-sm font-medium">Level (optional)<Select className="mt-1" value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}><option value="">Not set</option><option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="lead">Lead</option></Select></label>
          <label className="text-sm font-medium">Weekly capacity hours<Input className="mt-1" type="number" min="1" max="168" value={weeklyCapacityHours} onChange={(event) => setWeeklyCapacityHours(event.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={isManager} onChange={(event) => setIsManager(event.target.checked)} />Make this employee a manager</label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={saving || !name.trim() || !email.trim() || password.length < 8 || !Number(weeklyCapacityHours)} onClick={() => void save()}>{saving ? "Creating..." : "Create employee"}</Button>
          </div>
        </div>
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
        <div className="grid gap-4 pr-8">
          <label className="text-sm font-medium">Weekly capacity hours<Input className="mt-1" type="number" min="1" max="168" value={value} onChange={(event) => setValue(event.target.value)} /></label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setValue(""); onOpenChange(false); }}>Cancel</Button>
            <Button disabled={!currentEmployeeId || !Number(value)} onClick={() => void onSaved(Number(value))}>Save</Button>
          </div>
        </div>
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
