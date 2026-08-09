"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ImagePlus, MoreHorizontal, Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import {
  listTenantAdminEmployees,
  setTenantAdminEmployeeManager,
  type TenantAdminEmployeeOption,
} from "@/features/operations/api/operations-api";
import { saveTenantBrandingSession, tenantBrandingFontFamily } from "@/lib/tenant-branding-session";
import { organisationStructure } from "@/mocks/administration";
import { employees } from "@/mocks/workforce";
import { tenantBrandingDraftSchema, type TenantBrandingDraft } from "@/types/administration";
import type { Employee } from "@/types/workforce";

const employeeTabs = [
  { value: "overview", label: "Overview" },
  { value: "skills", label: "Skills" },
  { value: "assignments", label: "Assignments" },
  { value: "tasks", label: "Tasks" },
];

const settingsTabs = [
  { value: "branding", label: "Branding" },
  { value: "profile", label: "Profile" },
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
  const usesDatabaseEmployeeId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      employeeId,
    );
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployees,
    enabled: usesDatabaseEmployeeId,
  });
  const employeeRecord = usesDatabaseEmployeeId
    ? (employeesQuery.data ?? []).find((item) => item.id === employeeId)
    : employees.find((item) => item.id === employeeId);
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
  const employee: Employee =
    "code" in employeeRecord
      ? employeeRecord
      : {
          id: employeeRecord.id,
          code: employeeRecord.employeeCode ?? "-",
          name: employeeRecord.name,
          email: employeeRecord.email,
          department: "Unassigned",
          categories: employeeRecord.categories,
          skills: employeeRecord.skills,
          experienceLevel: employeeRecord.experienceLevel,
          manager:
            employeeRecord.managerId && employeeRecord.managerName
              ? { id: employeeRecord.managerId, name: employeeRecord.managerName }
              : null,
          workload: {
            allocatedHours: 0,
            capacityHours: employeeRecord.weeklyCapacityHours,
            risk: "balanced",
          },
          utilisationPercent: 0,
          activeTasks: employeeRecord.activeTasks,
          availability:
            employeeRecord.employmentStatus === "on_leave"
              ? "unavailable"
              : "available",
          employmentStatus:
            employeeRecord.employmentStatus === "on_leave"
              ? "on-leave"
              : employeeRecord.employmentStatus === "inactive"
                ? "inactive"
                : "active",
          workGroups: employeeRecord.workGroups,
          isManager: employeeRecord.isManager,
        };
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
    ) : null;
  return (
    <div className="flex flex-col gap-[30px]">
      <EntityHeader
        eyebrow="Workforce"
        title={employee.name}
        description={`${employee.code} · ${employee.department}`}
        metadata={
          <>
            <StatusBadge status={employee.employmentStatus} />
            {employee.email ? <span>{employee.email}</span> : null}
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
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployees,
  });
  const employees = employeesQuery.data ?? [];
  const managers = employees.filter((employee) => employee.isManager);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tenant-admin-employees"] });
  const removeManager = async (employee: TenantAdminEmployeeOption) => {
    try {
      await setTenantAdminEmployeeManager(employee.id, false);
      await refresh();
      toast.success("Manager removed.");
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
            Delete
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
        description="Select employees who can manage work groups and review assigned work."
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
      toast.success("Manager added.");
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
      <DialogContent title="Add manager" description="Select an active employee to make manager." className="max-w-md">
        <div className="grid gap-4 pr-8">
          <label className="text-sm font-medium">Employee<Select className="mt-1" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select></label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!employeeId || saving} onClick={() => void save()}>{saving ? "Adding..." : "Add manager"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  profileName: string;
};

const densityPreviewStyles = {
  compact: { padding: "12px", gap: "6px", label: "Compact" },
  comfortable: { padding: "16px", gap: "10px", label: "Comfortable" },
  relaxed: { padding: "20px", gap: "14px", label: "Relaxed" },
  spacious: { padding: "24px", gap: "18px", label: "Spacious" },
} as const;

const defaultBrandingColours = {
  primaryColour: "#3C50E0",
  sidebarColour: "#1C2434",
  surfaceColour: "#FFFFFF",
} as const;

function rgbValue(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "Enter a valid hex value";
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  return `RGB ${channels.join(", ")}`;
}

function BrandingSettings() {
  const [published, setPublished] = useState(false);
  const [customDesign, setCustomDesign] = useState<{ name: string; url: string } | null>(null);
  const form = useForm<TenantBrandingDraft>({
    resolver: zodResolver(tenantBrandingDraftSchema),
    defaultValues: {
      companyName: "SaaS App",
      ...defaultBrandingColours,
      defaultTheme: "system",
      density: "comfortable",
      headingFont: "System",
      allowUserThemeOverride: true,
      portalSubtitle: "",
    },
  });
  const preview = form.watch();
  useEffect(() => () => { if (customDesign) URL.revokeObjectURL(customDesign.url); }, [customDesign]);
  const previewTheme = preview.defaultTheme === "custom" && customDesign ? "custom" : preview.defaultTheme;
  const isDarkPreview = previewTheme === "dark";
  const densityStyle = densityPreviewStyles[preview.density];
  const selectCustomDesign = (file: File | null) => {
    if (!file) return;
    setCustomDesign({ name: file.name, url: URL.createObjectURL(file) });
    form.setValue("defaultTheme", "custom", { shouldDirty: true });
  };
  const saveDraft = () => setPublished(false);
  const resetColours = () => {
    form.setValue("primaryColour", defaultBrandingColours.primaryColour, { shouldDirty: true, shouldValidate: true });
    form.setValue("sidebarColour", defaultBrandingColours.sidebarColour, { shouldDirty: true, shouldValidate: true });
    form.setValue("surfaceColour", defaultBrandingColours.surfaceColour, { shouldDirty: true, shouldValidate: true });
    setPublished(false);
  };
  const publish = (draft: TenantBrandingDraft) => {
    saveTenantBrandingSession("acme", draft);
    setPublished(true);
  };
  return <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" noValidate onSubmit={form.handleSubmit(publish)}>
    <div className="flex flex-col gap-6">
      <Card><CardHeader><CardTitle>Brand identity</CardTitle><CardDescription>Set the company name shown in this tenant workspace and an optional portal subtitle.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Company name<Input className="mt-1" {...form.register("companyName")} />{form.formState.errors.companyName ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.companyName.message}</span> : null}</label><label className="block text-sm font-medium">Portal subtitle <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-1" placeholder="For example, Client services workspace" {...form.register("portalSubtitle")} />{form.formState.errors.portalSubtitle ? <span className="mt-1 block text-xs text-danger">{form.formState.errors.portalSubtitle.message}</span> : null}</label></CardContent></Card>
      <Card><CardHeader><CardTitle>Colour system</CardTitle><CardDescription>Choose an approved colour using the palette or enter an exact hex value. Semantic warning, error, and success colours remain platform controlled.</CardDescription></CardHeader><CardContent><div className="grid gap-5 sm:grid-cols-3">{(["primaryColour", "sidebarColour", "surfaceColour"] as const).map((key) => { const label = key === "primaryColour" ? "Primary colour" : key === "sidebarColour" ? "Sidebar surface colour" : "Surface colour"; return <div key={key} className="text-sm font-medium"><span>{label}</span><span className="mt-1 flex gap-2"><Input className="min-w-0" aria-label={`${label} hexadecimal value`} aria-invalid={Boolean(form.formState.errors[key])} {...form.register(key)} /><input aria-label={`Choose ${label.toLowerCase()} from palette`} className="size-10 shrink-0 cursor-pointer rounded-[var(--radius-control)] border border-border bg-transparent p-1" type="color" value={/^#[0-9a-f]{6}$/i.test(preview[key]) ? preview[key] : "#000000"} onChange={(event) => form.setValue(key, event.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })} /></span><span className="mt-1 block text-xs font-normal text-muted-foreground">{rgbValue(preview[key])}</span>{form.formState.errors[key] ? <span className="mt-1 block text-xs text-danger">{form.formState.errors[key]?.message}</span> : null}</div>; })}</div><div className="mt-5 flex justify-end border-t pt-4"><Button type="button" size="sm" variant="outline" onClick={resetColours}>Reset colours</Button></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Theme preferences</CardTitle><CardDescription>Preview theme, density, and font changes before publishing. The custom design image stays only in this browser preview.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Default theme<Select className="mt-1" {...form.register("defaultTheme")}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Follow system</option><option value="custom">Custom design preview</option></Select></label><label className="text-sm font-medium">Dashboard density<Select className="mt-1" {...form.register("density")}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="relaxed">Relaxed</option><option value="spacious">Spacious</option></Select></label><label className="text-sm font-medium">Preview font<Select className="mt-1" {...form.register("headingFont")}><option value="System">System UI</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Trebuchet">Trebuchet MS</option></Select></label><div className="text-sm font-medium"><span>Custom design <span className="font-normal text-muted-foreground">(optional)</span></span><label className="mt-1 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-within:ring-2 focus-within:ring-ring"><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectCustomDesign(event.target.files?.[0] ?? null)} /><ImagePlus className="size-4" aria-hidden="true" />Choose preview image</label>{customDesign ? <span className="mt-2 flex items-center justify-between gap-2 text-xs font-normal text-muted-foreground"><span className="truncate">{customDesign.name}</span><button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Remove custom design preview" onClick={() => { setCustomDesign(null); if (preview.defaultTheme === "custom") form.setValue("defaultTheme", "system", { shouldDirty: true }); }}><X className="size-4" /></button></span> : <span className="mt-2 block text-xs font-normal text-muted-foreground">PNG, JPG, or WebP. Not uploaded or stored.</span>}</div><label className="flex items-start gap-3 text-sm"><input className="mt-1 size-4 accent-primary" type="checkbox" {...form.register("allowUserThemeOverride")} /><span><span className="block font-medium">Allow user theme preference</span><span className="block text-muted-foreground">A future backend must resolve user, tenant, then platform preferences.</span></span></label></CardContent></Card>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={saveDraft}>Save draft</Button><Button type="submit">Publish changes</Button></div>{published ? <p role="status" className="text-sm text-muted-foreground">Branding is applied to Acme tenant workspaces in this browser. Custom design images are not uploaded or published.</p> : null}
    </div>
    <Card className="h-fit xl:sticky xl:top-6"><CardHeader><CardTitle className="flex items-center gap-2 text-primary"><span className="relative flex size-2" aria-hidden="true"><span className="absolute inline-flex size-full rounded-full bg-primary/45 motion-safe:animate-ping motion-reduce:hidden" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span><span className="live-preview-sweep">Live preview</span></CardTitle><CardDescription>Isolated preview; active users are not affected until you publish.</CardDescription></CardHeader><CardContent><div className="overflow-hidden rounded-[var(--radius-card)] border" style={{ backgroundColor: isDarkPreview ? "#172131" : preview.surfaceColour, color: isDarkPreview ? "#edf2f7" : preview.sidebarColour, fontFamily: tenantBrandingFontFamily(preview.headingFont) } as CSSProperties}><div className="relative" style={{ backgroundColor: preview.sidebarColour, padding: densityStyle.padding, gap: densityStyle.gap, backgroundImage: previewTheme === "custom" && customDesign ? `linear-gradient(rgb(17 25 39 / 0.74), rgb(17 25 39 / 0.9)), url(${customDesign.url})` : undefined, backgroundPosition: "center", backgroundSize: "cover" }}><p className="font-semibold text-white">{preview.companyName}</p><div className="mt-4 grid text-xs text-white/75" style={{ gap: densityStyle.gap }}><p>Dashboard</p><p>Clients</p><p>Documents</p></div>{previewTheme === "custom" ? <span className="absolute right-3 top-3 rounded-full bg-white/15 px-2 py-1 text-[10px] font-medium text-white">Custom preview</span> : null}</div><div style={{ padding: densityStyle.padding, backgroundImage: previewTheme === "custom" && customDesign ? `linear-gradient(rgb(255 255 255 / 0.9), rgb(255 255 255 / 0.96)), url(${customDesign.url})` : undefined, backgroundPosition: "center", backgroundSize: "cover" }}><p className="text-xs" style={{ color: isDarkPreview ? "#aab7c8" : "#64748b" }}>Tenant portal · {densityStyle.label} density</p><h3 className="mt-1 text-lg font-semibold" style={{ color: isDarkPreview ? "#edf2f7" : preview.sidebarColour }}>Welcome to {preview.companyName}</h3>{preview.portalSubtitle ? <p className="mt-1 text-sm" style={{ color: isDarkPreview ? "#aab7c8" : "#64748b" }}>{preview.portalSubtitle}</p> : null}<div className="mt-4 rounded-[var(--radius-control)] p-3 text-sm font-medium text-white" style={{ backgroundColor: preview.primaryColour }}>Primary action</div><div className="mt-4 rounded-[var(--radius-control)] border p-3 text-sm" style={{ borderColor: isDarkPreview ? "#34445b" : undefined }}>Dashboard card</div></div></div></CardContent></Card>
  </form>;
}

export function TenantSettings() {
  const [tab, setTab] = useState("branding");
  const [saved, setSaved] = useState(false);
  const form = useForm<SettingsInput>({
    defaultValues: {
      brandName: "SaaS App",
      primaryToken: "primary",
      profileName: "Jordan Lee",
    },
  });
  const panel =
    tab === "branding" ? <BrandingSettings /> : (
      <Card>
        <CardHeader>
          <CardTitle>Profile settings</CardTitle>
          <CardDescription>
            Settings validate locally and do not apply server-side changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-5"
            onSubmit={form.handleSubmit(() => setSaved(true))}
          >
            <label className="text-sm font-medium">
              Profile name
              <Input
                className="mt-1"
                {...form.register("profileName", { required: true })}
              />
            </label>
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
        description="Manage tenant branding and profile preferences."
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
