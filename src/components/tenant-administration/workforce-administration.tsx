"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { DataTable } from "@/components/operations/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityHeader } from "@/components/shared/entity-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
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
import { listManagers } from "@/features/administration/api/administration-api";
import { organisationStructure } from "@/mocks/administration";
import { employees } from "@/mocks/workforce";
import type { Manager } from "@/types/administration";
import type { Employee } from "@/types/workforce";

const employeeTabs = [
  { value: "overview", label: "Overview" },
  { value: "skills", label: "Skills" },
  { value: "assignments", label: "Assignments" },
  { value: "tasks", label: "Tasks" },
  { value: "work-logs", label: "Work logs" },
  { value: "timesheet", label: "Timesheet" },
  { value: "documents", label: "Documents" },
  { value: "activity", label: "Activity" },
];

const settingsTabs = [
  { value: "branding", label: "Branding" },
  { value: "users", label: "Users and roles" },
  { value: "notifications", label: "Notifications" },
  { value: "organisation", label: "Organisation" },
  { value: "profile", label: "Profile" },
  { value: "security", label: "Security" },
];

function Utilisation({
  value,
  label = "Utilisation",
}: {
  value: number;
  label?: string;
}) {
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-control)] bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function EmployeeProfile({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee)
    return (
      <EmptyState
        title="Employee not found"
        description="This profile is unavailable or the address is incorrect."
      />
    );
  const panel =
    tab === "overview" ? (
      <section className="grid gap-[30px] lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Work allocation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Utilisation value={employee.utilisationPercent} />
            <p className="text-sm text-muted-foreground">
              {employee.workload.allocatedHours} of{" "}
              {employee.workload.capacityHours} hours allocated ·{" "}
              {employee.activeTasks} active tasks.
            </p>
            <StatusBadge status={employee.workload.risk} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={employee.availability} />
            <p className="mt-3 text-sm text-muted-foreground">
              Employment status:{" "}
              {employee.employmentStatus.replaceAll("-", " ")}.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Manager and work groups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {employee.manager?.name ?? "Unassigned"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {employee.workGroups.map((group) => group.name).join(", ") ||
                "No current work groups"}
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
          <p className="font-medium">{employee.skills.join(", ")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Experience level: {employee.experienceLevel}. Categories:{" "}
            {employee.categories.join(", ")}.
          </p>
        </CardContent>
      </Card>
    ) : tab === "assignments" ? (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {employee.workGroups.map((group) => (
              <li key={group.id} className="py-3 first:pt-0">
                <p className="font-medium">{group.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current assigned work group
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    ) : tab === "tasks" ? (
      <Card>
        <CardHeader>
          <CardTitle>Current tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {employee.activeTasks} active tasks. Task details remain in the
            shared task workflow.
          </p>
        </CardContent>
      </Card>
    ) : tab === "work-logs" ? (
      <Card>
        <CardHeader>
          <CardTitle>Work logs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Daily work logs are tenant-scoped and require the future work-log
            API.
          </p>
        </CardContent>
      </Card>
    ) : tab === "timesheet" ? (
      <Card>
        <CardHeader>
          <CardTitle>Timesheet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This week: {employee.workload.allocatedHours} planned hours of{" "}
            {employee.workload.capacityHours} available hours.
          </p>
        </CardContent>
      </Card>
    ) : tab === "documents" ? (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Employee documents are visible only through the tenant-scoped
            document permission.
          </p>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3 text-sm">
            <li>Availability updated · Today</li>
            <li>Work group assignment reviewed · Yesterday</li>
            <li>Skills profile updated · Jul 18</li>
          </ol>
        </CardContent>
      </Card>
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <EntityHeader
        eyebrow="Workforce"
        title={employee.name}
        description={`${employee.code} · ${employee.department}`}
        metadata={
          <>
            <StatusBadge status={employee.employmentStatus} />
            <span>{employee.activeTasks} active tasks</span>
            <span>{employee.utilisationPercent}% utilised</span>
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
  const managersQuery = useQuery({
    queryKey: ["managers"],
    queryFn: listManagers,
  });
  const router = useRouter();
  if (managersQuery.isPending)
    return <LoadingState label="Loading managers" rows={3} />;
  if (managersQuery.isError)
    return (
      <ErrorState
        title="Manager directory could not load"
        onRetry={() => void managersQuery.refetch()}
      />
    );
  const data = managersQuery.data ?? [];
  const columns: ColumnDef<Manager>[] = [
    { accessorKey: "name", header: "Manager" },
    { accessorKey: "department", header: "Department" },
    {
      id: "portfolio",
      header: "Work groups / clients",
      cell: ({ row }) => `${row.original.workGroups} / ${row.original.clients}`,
    },
    { accessorKey: "employees", header: "Employees" },
    { accessorKey: "openTasks", header: "Open tasks" },
    { accessorKey: "pendingReviews", header: "Pending reviews" },
    {
      id: "utilisation",
      header: "Team utilisation",
      cell: ({ row }) => `${row.original.teamUtilisation}%`,
    },
    {
      id: "sla",
      header: "SLA performance",
      cell: ({ row }) => `${row.original.slaPerformance}%`,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/admin/employees/${row.original.id}`)}
        >
          View profile
        </Button>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Workforce"
        title="Managers"
        description="Review manager capacity, assigned delivery scope, pending reviews, and SLA performance."
      />
      <Card>
        <CardHeader>
          <CardTitle>Manager directory</CardTitle>
          <CardDescription>
            Use workload and SLA signals to rebalance assignments before
            delivery risk increases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <DataTable
              caption="Managers in the active tenant"
              columns={columns}
              data={data}
              emptyTitle="No managers"
              emptyDescription="Designate a manager when a work group needs delivery ownership."
            />
          </div>
          <div className="md:hidden">
            {data.map((manager) => (
              <MobileEntityCard
                key={manager.id}
                title={manager.name}
                identifier={manager.department}
                status={<StatusBadge status={manager.status} />}
                metadata={
                  <>
                    <div>
                      <dt className="text-muted-foreground">Work groups</dt>
                      <dd className="mt-0.5">{manager.workGroups}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Employees</dt>
                      <dd className="mt-0.5">{manager.employees}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Utilisation</dt>
                      <dd className="mt-0.5">{manager.teamUtilisation}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">SLA performance</dt>
                      <dd className="mt-0.5">{manager.slaPerformance}%</dd>
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
                    View profile
                  </Button>
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type OrganisationEntry = { id: string; name: string; description: string };

function OrganisationEntryForm({
  initial,
  onSave,
}: {
  initial?: OrganisationEntry;
  onSave: () => void;
}) {
  const form = useForm<OrganisationEntry>({
    defaultValues: initial ?? { id: "new", name: "", description: "" },
  });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSave)}>
      <h2 className="font-semibold">
        {initial ? `Edit ${initial.name}` : "Create organisation entry"}
      </h2>
      <label className="text-sm font-medium">
        Name
        <Input className="mt-1" required {...form.register("name")} />
      </label>
      <label className="text-sm font-medium">
        Description
        <textarea
          className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
          {...form.register("description")}
        />
      </label>
      <div className="flex justify-end">
        <Button type="submit">Validate entry</Button>
      </div>
    </form>
  );
}

export function OrganisationManagement() {
  const [tab, setTab] = useState("departments");
  const [editing, setEditing] = useState<OrganisationEntry | "new" | null>(
    null,
  );
  const [archiveTarget, setArchiveTarget] = useState<OrganisationEntry | null>(
    null,
  );
  const departments = organisationStructure.departments.map((department) => ({
    id: department.id,
    name: department.name,
    description: `${department.categories.join(", ")} · ${department.employees} employees`,
  }));
  const skills = organisationStructure.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: `${skill.employees} employees · ${skill.coverage}% coverage`,
  }));
  const entries = tab === "skills" ? skills : departments;
  const title =
    tab === "departments"
      ? "Departments"
      : tab === "categories"
        ? "Categories"
        : tab === "skills"
          ? "Skills"
          : "Capacity planning";
  const panel =
    tab === "capacity" ? (
      <Card>
        <CardHeader>
          <CardTitle>Capacity planning</CardTitle>
          <CardDescription>
            Review planned availability by department before assigning new
            service engagements.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {organisationStructure.departments.map((department, index) => (
            <Utilisation
              key={department.id}
              label={department.name}
              value={[78, 84, 92][index]}
            />
          ))}
          <p className="text-sm text-muted-foreground">
            Capacity plans use readable percentages and must not be used as an
            employee discipline metric.
          </p>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Create, edit, and archive requests retain validation locally until
              the organisation API is available.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            Create {title.slice(0, -1)}
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 py-4 first:pt-0"
              >
                <div>
                  <p className="font-medium">{entry.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(entry)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArchiveTarget(entry)}
                  >
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Workforce"
        title="Organisation structure"
        description="Maintain departments, categories, skills, and capacity context for tenant delivery."
      />
      <ResponsiveTabs
        tabs={[
          { value: "departments", label: "Departments" },
          { value: "categories", label: "Categories" },
          { value: "skills", label: "Skills" },
          { value: "capacity", label: "Capacity planning" },
        ]}
        value={tab}
        onValueChange={setTab}
        label="Organisation administration sections"
      >
        {panel}
      </ResponsiveTabs>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent
          title="Organisation entry"
          description="Validate an organisation configuration entry."
        >
          <OrganisationEntryForm
            initial={editing === "new" ? undefined : (editing ?? undefined)}
            onSave={() => setEditing(null)}
          />
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive organisation entry"
        description={`Archive ${archiveTarget?.name}. Historical assignment records must remain available through the future backend.`}
        confirmLabel="Archive entry"
        destructive
        onConfirm={() => setArchiveTarget(null)}
      />
    </div>
  );
}

type SettingsInput = {
  brandName: string;
  primaryToken: string;
  notifications: boolean;
  profileName: string;
  securityReminder: boolean;
};

export function TenantSettings() {
  const [tab, setTab] = useState("branding");
  const [saved, setSaved] = useState(false);
  const form = useForm<SettingsInput>({
    defaultValues: {
      brandName: "Acme Operations",
      primaryToken: "primary",
      notifications: true,
      profileName: "Jordan Lee",
      securityReminder: true,
    },
  });
  const panel =
    tab === "users" ? (
      <Card>
        <CardHeader>
          <CardTitle>Users and roles</CardTitle>
          <CardDescription>
            User and role assignment requires the approved identity and
            authorisation API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y text-sm">
            <li className="flex justify-between py-3 first:pt-0">
              <span>Jordan Lee</span>
              <span>Tenant Admin</span>
            </li>
            <li className="flex justify-between py-3">
              <span>Aarav Mehta</span>
              <span>Manager</span>
            </li>
            <li className="flex justify-between py-3">
              <span>Priya Nair</span>
              <span>Manager</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    ) : tab === "organisation" ? (
      <Card>
        <CardHeader>
          <CardTitle>Organisation settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Organisation structure is managed from the dedicated workforce
            administration area.
          </p>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>
            {tab === "branding"
              ? "Branding settings"
              : tab === "notifications"
                ? "Notification settings"
                : tab === "profile"
                  ? "Profile settings"
                  : "Security settings"}
          </CardTitle>
          <CardDescription>
            Settings validate locally and do not apply server-side changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={form.handleSubmit(() => setSaved(true))}
          >
            {tab === "branding" ? (
              <>
                <label className="text-sm font-medium">
                  Tenant display name
                  <Input
                    className="mt-1"
                    {...form.register("brandName", { required: true })}
                  />
                </label>
                <label className="text-sm font-medium">
                  Primary design token
                  <Select className="mt-1" {...form.register("primaryToken")}>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                  </Select>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Only approved design tokens can be selected; arbitrary
                    colours are not allowed.
                  </span>
                </label>
              </>
            ) : tab === "notifications" ? (
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 size-4 accent-primary"
                  type="checkbox"
                  {...form.register("notifications")}
                />
                <span>
                  <span className="block font-medium">
                    Send delivery-risk notifications
                  </span>
                  <span className="block text-muted-foreground">
                    The backend will determine recipients and enforce access
                    before delivery.
                  </span>
                </span>
              </label>
            ) : tab === "profile" ? (
              <label className="text-sm font-medium">
                Profile name
                <Input
                  className="mt-1"
                  {...form.register("profileName", { required: true })}
                />
              </label>
            ) : (
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 size-4 accent-primary"
                  type="checkbox"
                  {...form.register("securityReminder")}
                />
                <span>
                  <span className="block font-medium">
                    Require security review reminders
                  </span>
                  <span className="block text-muted-foreground">
                    Identity enforcement remains server-side.
                  </span>
                </span>
              </label>
            )}
            <div className="flex justify-end">
              <Button type="submit">Validate settings</Button>
            </div>
          </form>
          {saved ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Settings payload validated. No live tenant settings changed.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Tenant settings"
        description="Manage controlled branding, users, notifications, organisation, profile, and supported security preferences."
      />
      <ResponsiveTabs
        tabs={settingsTabs}
        value={tab}
        onValueChange={setTab}
        label="Tenant settings sections"
      >
        {panel}
      </ResponsiveTabs>
    </div>
  );
}
