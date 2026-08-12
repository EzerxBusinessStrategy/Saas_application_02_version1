"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/operations/data-table";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityHeader } from "@/components/shared/entity-header";
import { ErrorState } from "@/components/shared/error-state";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import { LoadingState } from "@/components/shared/loading-state";
import { MobileEntityCard } from "@/components/shared/mobile-entity-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
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
  createClient,
  createClientContact,
  deleteClient,
  getClient,
  listClients,
  updateClientContact,
} from "@/features/administration/api/administration-api";
import {
  createTenantAdminWorkGroup,
  listTenantAdminEmployees,
  listTenantAdminWorkGroups,
  updateTenantAdminWorkGroup,
  type TenantAdminEmployeeOption,
  type TenantAdminWorkGroup,
} from "@/features/operations/api/operations-api";
import { readFormDraft } from "@/lib/client/form-draft-store";
import { clients, managers } from "@/mocks/administration";
import {
  clientCreateInputSchema,
  clientContactInputSchema,
  type Client,
  type ClientContact,
  type ClientCreateInput,
  type ClientContactInput,
  type ClientListRequest,
} from "@/types/administration";

const revenueSteps = Array.from({ length: 10 }, (_, index) => (index + 1) * 10000);
const formatMoney = (amount: number, currencyCode: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
const billingUnitLabel = (value: string) => value.replace("per_", "per ");
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const clientTabs = [
  { value: "overview", label: "Overview" },
  { value: "contacts", label: "Contacts" },
  { value: "engagements", label: "Service engagements" },
  { value: "work-groups", label: "Work groups" },
  { value: "tasks", label: "Tasks" },
  { value: "billing", label: "Billing" },
  { value: "agreements", label: "Agreements" },
  { value: "documents", label: "Documents" },
  { value: "activity", label: "Activity" },
];

const updateUrl = (
  pathname: string,
  current: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  key: string,
  value: string,
) => {
  const next = new URLSearchParams(current);
  value ? next.set(key, value) : next.delete(key);
  if (key !== "page") next.delete("page");
  router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
    scroll: false,
  });
};

function ClientCard({
  client,
  onView,
}: {
  client: Client;
  onView: () => void;
}) {
  return (
    <MobileEntityCard
      title={client.name}
      identifier={client.code}
      status={<StatusBadge status={client.status} />}
      metadata={
        <>
          <div>
            <dt className="text-muted-foreground">Revenue</dt>
            <dd className="mt-0.5 font-medium">
              {formatMoney(client.revenueAmount, client.currencyCode)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Outstanding</dt>
            <dd className="mt-0.5 font-medium">
              {formatMoney(client.outstandingAmount, client.currencyCode)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Services</dt>
            <dd className="mt-0.5">{client.activeServices}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deadline</dt>
            <dd className="mt-0.5">
              {client.upcomingDeadline
                ? date.format(new Date(client.upcomingDeadline))
                : "None"}
            </dd>
          </div>
        </>
      }
      primaryAction={
        <Button variant="outline" size="sm" onClick={onView}>
          View client
        </Button>
      }
    />
  );
}

export function ClientDirectory() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const appliedSearch = searchParams.get("query") ?? "";
  const [searchValue, setSearchValue] = useState(appliedSearch);
  const setParam = useCallback(
    (key: string, value: string) =>
      updateUrl(pathname, new URLSearchParams(searchParams), router, key, value),
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setSearchValue(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    if (searchValue === appliedSearch) return;
    const timeout = window.setTimeout(() => setParam("query", searchValue), 300);
    return () => window.clearTimeout(timeout);
  }, [appliedSearch, searchValue, setParam]);
  const request = useMemo<ClientListRequest>(
    () => ({
      query: searchParams.get("query") ?? undefined,
      status: searchParams.get("status") as ClientListRequest["status"],
      service: searchParams.get("service") ?? undefined,
      manager: searchParams.get("manager") ?? undefined,
      revenueMin:
        searchParams.get("revenueMin") &&
        Number.isFinite(Number(searchParams.get("revenueMin")))
          ? Number(searchParams.get("revenueMin"))
          : undefined,
      deadline: searchParams.get("deadline") as ClientListRequest["deadline"],
      sort: (searchParams.get("sort") as ClientListRequest["sort"]) ?? "name",
      page: Math.max(1, Number(searchParams.get("page") ?? "1")),
      pageSize: [5, 10, 25, 50].includes(Number(searchParams.get("pageSize")))
        ? Number(searchParams.get("pageSize"))
        : 5,
    }),
    [searchParams],
  );
  const query = useQuery({
    queryKey: ["clients", request],
    queryFn: () => listClients(request),
  });
  const saveClient = async (values: ClientCreateInput) => {
    const client = await createClient(values);
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
    setCreateOpen(false);
    toast.success("Client created.");
    router.push(`/admin/clients/${client.id}`);
  };
  const setParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      value ? next.set(key, value) : next.delete(key);
      if (key !== "page") next.delete("page");
    });
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  };
  const activeFilterCount = [
    request.query,
    request.status,
    request.service,
    request.manager,
    request.revenueMin,
    request.deadline && request.deadline !== "any"
      ? request.deadline
      : undefined,
  ].filter(Boolean).length;
  const revenueSelectValue =
    searchParams.get("revenueMode") === "custom"
      ? "custom"
      : request.revenueMin === undefined
      ? ""
      : revenueSteps.includes(request.revenueMin)
        ? String(request.revenueMin)
        : "custom";
  const columns: ColumnDef<Client>[] = [
    {
      id: "client",
      header: "Client",
      cell: ({ row }) => (
        <div>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => router.push(`/admin/clients/${row.original.id}`)}
          >
            {row.original.name}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.original.code}
          </p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Primary contact",
      cell: ({ row }) => (
        <div>
          <p>{row.original.primaryContact.name}</p>
          <p
            className="mt-1 max-w-48 truncate text-xs text-muted-foreground"
            title={row.original.primaryContact.email}
          >
            {row.original.primaryContact.email}
          </p>
        </div>
      ),
    },
    {
      id: "services",
      header: "Active services",
      cell: ({ row }) => (
        <span>
          {row.original.activeServices}
          <span
            className="mt-1 block max-w-40 truncate text-xs text-muted-foreground"
            title={row.original.services.join(", ")}
          >
            {row.original.services.join(", ")}
          </span>
        </span>
      ),
    },
    {
      id: "managers",
      header: "Managers",
      cell: ({ row }) => (
        <span
          className="block max-w-40 truncate"
          title={row.original.managers.join(", ")}
        >
          {row.original.managers.join(", ")}
        </span>
      ),
    },
    {
      id: "revenue",
      header: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onClick={() =>
            setParam("sort", request.sort === "revenue" ? "name" : "revenue")
          }
        >
          Revenue <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </button>
      ),
      cell: ({ row }) => formatMoney(row.original.revenueAmount, row.original.currencyCode),
    },
    {
      id: "balance",
      header: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onClick={() =>
            setParam("sort", request.sort === "outstanding" ? "name" : "outstanding")
          }
        >
          Outstanding <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </button>
      ),
      cell: ({ row }) => formatMoney(row.original.outstandingAmount, row.original.currencyCode),
    },
    {
      id: "deadline",
      header: "Upcoming deadline",
      cell: ({ row }) =>
        row.original.upcomingDeadline
          ? date.format(new Date(row.original.upcomingDeadline))
          : "—",
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Actions for ${row.original.name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => router.push(`/admin/clients/${row.original.id}`)}
            >
              View client
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                router.push(`/admin/clients/${row.original.id}?tab=contacts`)
              }
            >
              Manage contacts
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDeleteTarget(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
  if (query.isPending) return <LoadingState label="Loading clients" rows={5} />;
  if (query.isError)
    return (
      <ErrorState
        title="Client directory could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const clients = query.data?.items ?? [];
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Clients"
        description="Manage client delivery context, contacts, service engagements, and due work."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Create client
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Client directory</CardTitle>
          <CardDescription>
            Tenant-scoped clients with billing totals, contacts, services, and deadlines.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FilterToolbar
            search={{
              value: searchValue,
              onChange: setSearchValue,
              label: "Search clients",
              placeholder: "Search client name or ID",
            }}
            activeFilterCount={activeFilterCount}
            onClear={() => router.replace(pathname, { scroll: false })}
            trailing={
              <Select
                aria-label="Client sort order"
                className="w-36"
                value={request.sort}
                onChange={(event) => setParam("sort", event.target.value)}
              >
                <option value="name">Name</option>
                <option value="revenue">Revenue</option>
                <option value="outstanding">Outstanding</option>
                <option value="deadline">Deadline</option>
              </Select>
            }
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <Select
                aria-label="Filter client status"
                value={request.status ?? ""}
                onChange={(event) => setParam("status", event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="onboarding">Onboarding</option>
                <option value="paused">Paused</option>
                <option value="archived">Deleted clients</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Service
              <Select
                aria-label="Filter by service"
                value={request.service ?? ""}
                onChange={(event) => setParam("service", event.target.value)}
              >
                <option value="">All services</option>
                {(query.data?.filters.services ?? []).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Manager
              <Select
                aria-label="Filter by manager"
                value={request.manager ?? ""}
                onChange={(event) => setParam("manager", event.target.value)}
              >
                <option value="">All managers</option>
                {(query.data?.filters.managers ?? []).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Revenue
              <Select
                aria-label="Filter by revenue"
                value={revenueSelectValue}
                onChange={(event) =>
                  setParams({
                    revenueMode: event.target.value === "custom" ? "custom" : "",
                    revenueMin: event.target.value === "custom" ? "" : event.target.value,
                  })
                }
              >
                <option value="">Any revenue</option>
                {revenueSteps.map((value) => (
                  <option key={value} value={value}>
                    {formatMoney(value, clients[0]?.currencyCode ?? "INR")}+
                  </option>
                ))}
                <option value="custom">Custom</option>
              </Select>
            </label>
            {revenueSelectValue === "custom" ? (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Custom revenue
                <Input
                  aria-label="Custom minimum revenue"
                  inputMode="decimal"
                  min="0"
                  type="number"
                  value={request.revenueMin ?? ""}
                  onChange={(event) => setParam("revenueMin", event.target.value)}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Upcoming deadline
              <Select
                aria-label="Filter upcoming deadline"
                value={request.deadline ?? "any"}
                onChange={(event) => setParam("deadline", event.target.value)}
              >
                <option value="any">Any deadline</option>
                <option value="upcoming">Has deadline</option>
                <option value="none">No deadline</option>
              </Select>
            </label>
          </FilterToolbar>
          {clients.length ? (
            <>
              <div className="hidden md:block">
                <DataTable
                  caption="Clients in the active tenant"
                  columns={columns}
                  data={clients}
                  emptyTitle="No clients"
                  emptyDescription="Client records will appear here."
                />
              </div>
              <div className="md:hidden">
                {clients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onView={() => router.push(`/admin/clients/${client.id}`)}
                  />
                ))}
              </div>
              <Pagination
                page={query.data?.page ?? request.page}
                pageCount={query.data?.pageCount ?? 1}
                totalItems={query.data?.totalItems ?? 0}
                pageSize={request.pageSize}
                onPageChange={(value) => setParam("page", String(value))}
                onPageSizeChange={(value) =>
                  setParam("pageSize", String(value))
                }
                isLoading={query.isFetching}
              />
            </>
          ) : (
            <EmptyState
              title={
                activeFilterCount
                  ? "No clients match these filters"
                  : "No clients yet"
              }
              description={
                activeFilterCount
                  ? "Change or clear filters to see client records."
                  : "Create a client when an engagement is ready to be planned."
              }
            />
          )}
        </CardContent>
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title="Create client"
          description="Create a tenant-scoped client record and primary contact."
        >
          <CreateClientForm onClose={() => setCreateOpen(false)} onSave={saveClient} />
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Delete client"
        description={`Move ${deleteTarget?.name ?? "this client"} to deleted clients. History, tasks, invoices and audit logs will be preserved.`}
        confirmLabel="Delete client"
        destructive
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteClient(deleteTarget.id);
            await queryClient.invalidateQueries({ queryKey: ["clients"] });
            setDeleteTarget(null);
            setParam("status", "archived");
            toast.success("Client moved to deleted clients.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Client could not be deleted.");
          }
        }}
      />
    </div>
  );
}

function CreateClientForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (values: ClientCreateInput) => Promise<void>;
}) {
  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateInputSchema),
    defaultValues: {
      displayName: "",
      legalName: "",
      code: "",
      primaryContact: {
        name: "",
        role: "",
        email: "",
        phone: "",
      },
      portalAccess: {
        email: "",
        phone: "",
        password: "",
      },
    },
  });
  return (
    <form
      data-draft-key="tenant-client-create"
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSave(values);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Client could not be created.");
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Client name
          <Input
            className="mt-1"
            required
            data-field-label="Client name"
            aria-invalid={Boolean(form.formState.errors.displayName)}
            {...form.register("displayName")}
          />
          {form.formState.errors.displayName ? (
            <span className="mt-1 block text-xs text-danger">{form.formState.errors.displayName.message}</span>
          ) : null}
        </label>
        <label className="text-sm font-medium">
          Legal name
          <Input className="mt-1" {...form.register("legalName")} />
        </label>
        <label className="text-sm font-medium">
          Client ID
          <Input className="mt-1 uppercase" placeholder="Auto-generated if empty" {...form.register("code")} />
        </label>
      </div>
      <div className="border-t pt-4">
        <h2 className="text-sm font-semibold">Primary contact</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Name
            <Input
              className="mt-1"
              required
              data-field-label="Primary contact name"
              aria-invalid={Boolean(form.formState.errors.primaryContact?.name)}
              {...form.register("primaryContact.name")}
            />
            {form.formState.errors.primaryContact?.name ? (
              <span className="mt-1 block text-xs text-danger">{form.formState.errors.primaryContact.name.message}</span>
            ) : null}
          </label>
          <label className="text-sm font-medium">
            Role
            <Input className="mt-1" {...form.register("primaryContact.role")} />
          </label>
          <label className="text-sm font-medium">
            Email
            <Input
              className="mt-1"
              type="email"
              required
              data-field-label="Primary contact email"
              aria-invalid={Boolean(form.formState.errors.primaryContact?.email)}
              {...form.register("primaryContact.email")}
            />
            {form.formState.errors.primaryContact?.email ? (
              <span className="mt-1 block text-xs text-danger">{form.formState.errors.primaryContact.email.message}</span>
            ) : null}
          </label>
          <label className="text-sm font-medium">
            Phone
            <Input className="mt-1" {...form.register("primaryContact.phone")} />
          </label>
        </div>
      </div>
      <div className="border-t pt-4">
        <h2 className="text-sm font-semibold">Client portal login</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Login email
            <Input
              className="mt-1"
              type="email"
              required
              data-field-label="Login email"
              aria-invalid={Boolean(form.formState.errors.portalAccess?.email)}
              {...form.register("portalAccess.email")}
            />
            {form.formState.errors.portalAccess?.email ? (
              <span className="mt-1 block text-xs text-danger">{form.formState.errors.portalAccess.email.message}</span>
            ) : null}
          </label>
          <label className="text-sm font-medium">
            Phone
            <Input className="mt-1" {...form.register("portalAccess.phone")} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Temporary password
            <Input
              className="mt-1"
              type="password"
              required
              data-field-label="Temporary password"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.portalAccess?.password)}
              {...form.register("portalAccess.password")}
            />
            {form.formState.errors.portalAccess?.password ? (
              <span className="mt-1 block text-xs text-danger">{form.formState.errors.portalAccess.password.message}</span>
            ) : null}
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create client"}
        </Button>
      </div>
    </form>
  );
}

function ContactForm({
  contact,
  onSave,
}: {
  contact?: ClientContact;
  onSave: (values: ClientContactInput) => Promise<void>;
}) {
  const form = useForm<ClientContactInput>({
    resolver: zodResolver(clientContactInputSchema),
    defaultValues: contact
      ? {
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          preference: contact.preference,
          primary: contact.primary,
          notes: contact.notes,
        }
      : {
          name: "",
          role: "",
          email: "",
          phone: "",
          preference: "email",
          primary: false,
          notes: "",
        },
  });
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(onSave)}
    >
      <h2 className="font-semibold">
        {contact ? "Edit contact" : "Create contact"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Name
          <Input
            className="mt-1"
            required
            data-field-label="Contact name"
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <span className="mt-1 block text-xs text-danger">
              {form.formState.errors.name.message}
            </span>
          ) : null}
        </label>
        <label className="text-sm font-medium">
          Role or designation
          <Input className="mt-1" {...form.register("role")} />
        </label>
        <label className="text-sm font-medium">
          Email
          <Input
            className="mt-1"
            type="email"
            required
            data-field-label="Contact email"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <span className="mt-1 block text-xs text-danger">
              {form.formState.errors.email.message}
            </span>
          ) : null}
        </label>
        <label className="text-sm font-medium">
          Phone
          <Input className="mt-1" {...form.register("phone")} />
        </label>
        <label className="text-sm font-medium">
          Communication preference
          <Select className="mt-1" {...form.register("preference")}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="portal">Portal</option>
          </Select>
        </label>
        <label className="flex items-center gap-3 self-end text-sm">
          <input
            className="size-4 accent-primary"
            type="checkbox"
            {...form.register("primary")}
          />
          Primary contact
        </label>
      </div>
      <label className="text-sm font-medium">
        Notes
        <textarea
          className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...form.register("notes")}
        />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save contact"}
        </Button>
      </div>
    </form>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
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

type DetailRecord = object;
const recordText = (record: DetailRecord, key: string, fallback = "") =>
  typeof (record as Record<string, unknown>)[key] === "string"
    ? ((record as Record<string, unknown>)[key] as string)
    : fallback;
const recordNumber = (record: DetailRecord, key: string, fallback = 0) =>
  typeof (record as Record<string, unknown>)[key] === "number"
    ? ((record as Record<string, unknown>)[key] as number)
    : fallback;

export function ClientDetail({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "overview");
  const [editingContact, setEditingContact] = useState<
    ClientContact | "new" | null
  >(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientContact | null>(
    null,
  );
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  if (clientQuery.isPending)
    return <LoadingState label="Loading client details" rows={4} />;
  if (clientQuery.isError)
    return (
      <ErrorState
        title="Client details could not load"
        onRetry={() => void clientQuery.refetch()}
      />
    );
  if (!clientQuery.data)
    return (
      <EmptyState
        title="Client not found"
        description="This client may have been archived or the address is incorrect."
      />
    );
  const client = clientQuery.data;
  const contacts = client.contacts;
  const saveContact = async (values: ClientContactInput) => {
    if (editingContact === "new") {
      await createClientContact(client.id, values);
    } else if (editingContact) {
      await updateClientContact(client.id, editingContact.id, values);
    }
    await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    setEditingContact(null);
  };
  const archiveContact = async () => {
    if (!archiveTarget) return;
    await updateClientContact(client.id, archiveTarget.id, { status: "archived" });
    await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    setArchiveTarget(null);
  };
  const panel =
    tab === "overview" ? (
      <section className="grid gap-[30px] xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Client overview</CardTitle>
            <CardDescription>
              Contacts, services, managers, tasks, deadlines, and receivables.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Primary contact</p>
              <p className="mt-1 font-medium">{client.primaryContact.name}</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {client.primaryContact.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="mt-1 font-medium">
                {formatMoney(client.revenueAmount, client.currencyCode)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active services</p>
              <p className="mt-1 font-medium">{client.services.join(", ")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned managers</p>
              <p className="mt-1 font-medium">{client.managers.join(", ")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Open and at-risk tasks
              </p>
              <p className="mt-1 font-medium">
                {client.openTasks} open · {client.atRiskTasks} at risk
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming deadline</p>
              <p className="mt-1 font-medium">
                {client.upcomingDeadline
                  ? date.format(new Date(client.upcomingDeadline))
                  : "No deadline"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue and receivables</CardTitle>
            <CardDescription>
              Amounts are calculated from successful payments and unpaid invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatMoney(client.revenueAmount, client.currencyCode)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatMoney(client.outstandingAmount, client.currencyCode)}
                </p>
              </div>
            </div>
            <ProgressRow
              label="Client onboarding"
              value={client.onboardingProgress}
            />
          </CardContent>
        </Card>
      </section>
    ) : tab === "contacts" ? (
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Client contacts</CardTitle>
            <CardDescription>
              Maintain primary and secondary contacts with safe archive actions.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditingContact("new")}>
            <Plus data-icon="inline-start" />
            Add contact
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length ? (
            <ul className="flex flex-col divide-y">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {contact.name}
                      {contact.primary ? " · Primary" : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contact.role} · {contact.preference}
                    </p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {contact.email} · {contact.phone}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contact.notes}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={
                        contact.status === "archived" ? "archived" : "active"
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={contact.status === "archived"}
                      onClick={() => setEditingContact(contact)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={contact.status === "archived"}
                      onClick={() => setArchiveTarget(contact)}
                    >
                      Archive
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No contacts"
              description="Add the first contact for this client."
            />
          )}
        </CardContent>
      </Card>
    ) : tab === "engagements" ? (
      <Card>
        <CardHeader>
          <CardTitle>Service engagements</CardTitle>
          <CardDescription>
            Progress, service scope, SLA, people, and milestones for the
            selected client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {client.engagements.length ? (
            <div className="grid gap-5">
              {client.engagements.map((engagement) => (
                <article
                  key={recordText(engagement, "id")}
                  className="border-b pb-5 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="font-medium">{recordText(engagement, "name")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {engagement.code} · {engagement.service} ·{" "}
                        {engagement.billingModel}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={engagement.status} />
                      <StatusBadge status={engagement.slaStatus} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <p>{engagement.manager} · manager</p>
                    <p>
                      {engagement.employees} employees · {engagement.openTasks}{" "}
                      open tasks
                    </p>
                    <p>
                      {engagement.startDate} to {engagement.endDate}
                    </p>
                  </div>
                  <div className="mt-4">
                    <ProgressRow
                      label="Engagement milestone progress"
                      value={engagement.progress}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Milestones: {engagement.milestones.join(" · ")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No service engagements"
              description="Active engagements for this client will appear here."
            />
          )}
        </CardContent>
      </Card>
    ) : tab === "work-groups" ? (
      <Card>
        <CardHeader>
          <CardTitle>Work groups</CardTitle>
          <CardDescription>
            Capacity and SLA context for client delivery groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {client.workGroups.length ? (
            <ul className="flex flex-col divide-y">
              {client.workGroups.map((group) => (
                  <li
                    key={recordText(group, "id")}
                    className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{recordText(group, "name")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {group.manager} · {group.members} members ·{" "}
                        {group.openTasks} open tasks
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={group.slaStatus} />
                      <StatusBadge status={group.status} />
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState
              title="No work groups"
              description="Work groups linked to this client will appear here."
            />
          )}
        </CardContent>
      </Card>
    ) : tab === "tasks" ? (
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Task delivery is managed in the shared task workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {client.tasks.length ? (
            <ul className="flex flex-col divide-y">
              {client.tasks.map((task) => (
                <li key={recordText(task, "id")} className="py-4 first:pt-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{recordText(task, "title")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Due {recordText(task, "plannedDueAt", "No due date")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-[var(--radius-control)] bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
                        {recordText(task, "priority")}
                      </span>
                      <span className="rounded-[var(--radius-control)] bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
                        {recordText(task, "status").replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No tasks"
              description="Tasks linked to this client will appear here."
            />
          )}
        </CardContent>
      </Card>
    ) : tab === "billing" ? (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Billing visibility is role- and server-permission dependent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(client.revenueAmount, client.currencyCode)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(client.outstandingAmount, client.currencyCode)}
              </p>
            </div>
          </div>
          <div className="mb-6">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-medium">Rate Card</p>
                <p className="text-sm text-muted-foreground">
                  Active reusable rates and task-only archived rates for this client.
                </p>
              </div>
            </div>
            {client.rateItems.length ? (
              <div className="overflow-x-auto border">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium">Task type</th>
                      <th className="px-4 py-3 font-medium">Unit</th>
                      <th className="px-4 py-3 font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Effective</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {client.rateItems.map((rate) => (
                      <tr key={rate.id}>
                        <td className="px-4 py-3">{rate.service}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{rate.taskType}</p>
                          <p className="text-xs text-muted-foreground">{rate.rateCardName}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">{billingUnitLabel(rate.billingUnit)}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(rate.rateAmount, rate.currencyCode)}
                          {rate.taxCode ? (
                            <span className="ml-1 text-xs text-muted-foreground">+ {rate.taxCode}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {date.format(new Date(rate.effectiveFrom))}
                          {rate.effectiveTo ? ` - ${date.format(new Date(rate.effectiveTo))}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={rate.status} />
                        </td>
                        <td className="px-4 py-3">{rate.tasksUsingRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No rate-card items"
                description="Rates created from the task form will appear here."
              />
            )}
          </div>
          {client.invoices.length ? (
            <ul className="flex flex-col divide-y">
              {client.invoices.map((invoice) => (
                <li
                  key={recordText(invoice, "id")}
                  className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{recordText(invoice, "invoiceNumber")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Due {recordText(invoice, "dueOn")} - Paid{" "}
                      {formatMoney(recordNumber(invoice, "paidAmount"), recordText(invoice, "currencyCode", client.currencyCode))}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-medium">
                      {formatMoney(recordNumber(invoice, "totalAmount"), recordText(invoice, "currencyCode", client.currencyCode))}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatMoney(recordNumber(invoice, "outstandingAmount"), recordText(invoice, "currencyCode", client.currencyCode))} outstanding
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    ) : tab === "agreements" ? (
      <Card>
        <CardHeader>
          <CardTitle>Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No agreements"
            description="Agreement records connected to this client will appear here."
          />
        </CardContent>
      </Card>
    ) : tab === "documents" ? (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No documents"
            description="Document records connected to this client will appear here."
          />
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>Client activity</CardTitle>
        </CardHeader>
        <CardContent>
          {client.activity.length ? (
            <ol className="flex flex-col gap-4 text-sm">
              {client.activity.map((item) => (
                <li key={recordText(item, "id")}>
                  <span className="font-medium">{recordText(item, "action")}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    - {recordText(item, "resourceType", "client")} - {recordText(item, "createdAt")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No activity"
              description="Successful audit events linked to this client will appear here."
            />
          )}
        </CardContent>
      </Card>
    );
  return (
    <div className="flex flex-col gap-[30px]">
      <EntityHeader
        eyebrow="Client management"
        title={client.name}
        description={client.code}
        metadata={
          <>
            <StatusBadge status={client.status} />
            <span>{client.activeServices} active services</span>
            <span>{client.openTasks} open tasks</span>
          </>
        }
      />
      <ResponsiveTabs
        tabs={clientTabs}
        value={tab}
        onValueChange={setTab}
        label="Client detail sections"
      >
        {panel}
      </ResponsiveTabs>
      <Dialog
        open={Boolean(editingContact)}
        onOpenChange={(open) => !open && setEditingContact(null)}
      >
        <DialogContent
          title={
            editingContact === "new"
              ? "Create client contact"
              : "Edit client contact"
          }
          description="Save this contact to the client record."
        >
          <ContactForm
            contact={
              editingContact === "new"
                ? undefined
                : (editingContact ?? undefined)
            }
            onSave={saveContact}
          />
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive client contact"
        description={`Archive ${archiveTarget?.name}. Archived contacts stay in the record and cannot receive new delivery notifications.`}
        confirmLabel="Archive contact"
        destructive
        onConfirm={() => void archiveContact()}
      />
    </div>
  );
}

type WorkGroupFormValues = {
  name: string;
  clientId: string;
  managerEmployeeId: string;
  employeeIds: string[];
  status: "active" | "inactive" | "archived";
};

function WorkGroupForm({
  workGroup,
  employees,
  clientOptions,
  onClose,
  onSubmit,
}: {
  workGroup?: TenantAdminWorkGroup;
  employees: readonly TenantAdminEmployeeOption[];
  clientOptions: readonly { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (values: WorkGroupFormValues) => void;
}) {
  const managers = employees.filter((employee) => employee.isManager);
  const [values, setValues] = useState<WorkGroupFormValues>({
    name: workGroup?.name ?? "",
    clientId: workGroup?.clientId ?? "",
    managerEmployeeId: workGroup?.managerEmployeeId ?? managers[0]?.id ?? "",
    employeeIds: workGroup?.members.map((member) => member.id) ?? [],
    status: (workGroup?.status as WorkGroupFormValues["status"]) ?? "active",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const selectedEmployees = new Set(values.employeeIds);
  const submitDisabled =
    values.name.trim().length < 2 ||
    !values.managerEmployeeId ||
    selectedEmployees.size === 0;
  return (
    <form
      data-draft-key={`tenant-work-group-${workGroup?.id ?? "create"}`}
      className="grid max-h-[70vh] gap-5 overflow-y-auto pr-1 sm:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (values.name.trim().length < 2) {
          setFormError("Enter Work-group name.");
          return;
        }
        if (!values.managerEmployeeId) {
          setFormError("Choose Manager.");
          return;
        }
        if (selectedEmployees.size === 0) {
          setFormError("Choose at least one employee.");
          return;
        }
        setFormError(null);
        onSubmit({ ...values, employeeIds: [...selectedEmployees] });
      }}
    >
      <label className="text-sm font-medium sm:col-span-2">
        Work-group name
        <Input required data-field-label="Work-group name" name="name" className="mt-1" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
      </label>
      {formError ? <p className="text-sm text-danger sm:col-span-2" role="alert">{formError}</p> : null}
      <label className="text-sm font-medium">
        Client
        <Select name="clientId" className="mt-1" value={values.clientId} onChange={(event) => setValues((current) => ({ ...current, clientId: event.target.value }))}>
          <option value="">No client</option>
          {clientOptions.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm font-medium">
        Manager
        <Select
          className="mt-1"
          required
          data-field-label="Manager"
          name="managerEmployeeId"
          value={values.managerEmployeeId}
          onChange={(event) => {
            const managerEmployeeId = event.target.value;
            setValues((current) => ({
              ...current,
              managerEmployeeId,
              employeeIds: managerEmployeeId ? [...new Set([...current.employeeIds, managerEmployeeId])] : current.employeeIds,
            }));
          }}
        >
          <option value="">Select manager</option>
          {managers.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        {!managers.length ? <span className="mt-1 block text-xs text-muted-foreground">Mark an employee as a manager before creating this work group.</span> : null}
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">Employees</legend>
        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-[var(--radius-control)] border p-3 sm:grid-cols-2">
          {employees.length ? (
            employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="employeeIds"
                  value={employee.id}
                  className="size-4 accent-primary"
                  checked={selectedEmployees.has(employee.id)}
                  onChange={() =>
                    setValues((current) => ({
                      ...current,
                      employeeIds: selectedEmployees.has(employee.id)
                        ? current.employeeIds.filter((id) => id !== employee.id)
                        : [...current.employeeIds, employee.id],
                    }))
                  }
                />
                <span>{employee.name}</span>
              </label>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Create an employee before creating a work group.</p>
          )}
        </div>
      </fieldset>
      <label className="text-sm font-medium">
        Status
        <Select name="status" className="mt-1" value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value as WorkGroupFormValues["status"] }))}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </Select>
      </label>
      <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          {workGroup ? "Save work group" : "Create work group"}
        </Button>
      </div>
    </form>
  );
}

export function WorkGroupDirectory() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const groupsQuery = useQuery({
    queryKey: ["work-groups"],
    queryFn: listTenantAdminWorkGroups,
  });
  const employeesQuery = useQuery({
    queryKey: ["tenant-admin-employees"],
    queryFn: listTenantAdminEmployees,
  });
  const clientsQuery = useQuery({
    queryKey: ["clients", "work-group-options"],
    queryFn: () => listClients({ page: 1, pageSize: 100 }),
  });
  const [selected, setSelected] = useState<TenantAdminWorkGroup | null>(null);
  const [editing, setEditing] = useState<TenantAdminWorkGroup | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (readFormDraft(`${pathname}:tenant-work-group-create`)) {
      setEditing("new");
    }
  }, [pathname]);
  const hasInitialData = Boolean(groupsQuery.data && employeesQuery.data && clientsQuery.data);
  if (!hasInitialData && (groupsQuery.isPending || employeesQuery.isPending || clientsQuery.isPending))
    return <LoadingState label="Loading work groups" rows={4} />;
  if (groupsQuery.isError || employeesQuery.isError || clientsQuery.isError)
    return (
      <ErrorState
        title="Work groups could not load"
        onRetry={() => {
          void groupsQuery.refetch();
          void employeesQuery.refetch();
          void clientsQuery.refetch();
        }}
      />
    );
  const groups = groupsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const clientOptions = clientsQuery.data?.items.map((client) => ({ id: client.id, name: client.name })) ?? [];
  const saveWorkGroup = async (values: WorkGroupFormValues) => {
    setSaving(true);
    try {
      const input = {
        name: values.name.trim(),
        clientId: values.clientId || undefined,
        managerEmployeeId: values.managerEmployeeId,
        employeeIds: values.employeeIds,
        status: values.status,
      };
      if (editing && editing !== "new") await updateTenantAdminWorkGroup(editing.id, input);
      else await createTenantAdminWorkGroup(input);
      await queryClient.invalidateQueries({ queryKey: ["work-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant-admin-task-options"] });
      setEditing(null);
      toast.success(editing && editing !== "new" ? "Work group updated." : "Work group created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Work group could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const columns: ColumnDef<TenantAdminWorkGroup>[] = [
    { accessorKey: "name", header: "Work group" },
    { id: "client", header: "Client", cell: ({ row }) => row.original.clientName ?? <span className="text-muted-foreground">No client</span> },
    { accessorKey: "managerName", header: "Manager" },
    { accessorKey: "memberCount", header: "Employees" },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(row.original)}
          >
            View details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(row.original)}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Work groups"
        description="Balance capacity, work allocation, SLA health, and client delivery ownership."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            Create work group
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Work group directory</CardTitle>
          <CardDescription>
            Tenant-scoped work groups from the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <DataTable
              caption="Work groups in the active tenant"
              columns={columns}
              data={groups}
              emptyTitle="No work groups"
              emptyDescription="Create a work group once a service engagement is ready."
            />
          </div>
          <div className="md:hidden">
            {groups.map((group) => (
              <MobileEntityCard
                key={group.id}
                title={group.name}
                identifier={group.clientName ?? "No client"}
                status={<StatusBadge status={group.status} />}
                metadata={
                  <>
                    <div>
                      <dt className="text-muted-foreground">Client</dt>
                      <dd className="mt-0.5">{group.clientName ?? "No client"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Manager</dt>
                      <dd className="mt-0.5">{group.managerName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Employees</dt>
                      <dd className="mt-0.5">{group.memberCount}</dd>
                    </div>
                  </>
                }
                primaryAction={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(group)}
                  >
                    View details
                  </Button>
                }
                overflowActions={[
                  { label: "Edit", onSelect: () => setEditing(group) },
                ]}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          title="Work group details"
          description="Employees and manager in this work group."
        >
          <div className="pr-8">
            {selected ? (
              <>
                <h2 className="font-semibold">{selected.name}</h2>
                <dl className="mt-5 grid gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      Client
                    </dt>
                    <dd className="mt-1">
                      {selected.clientName ?? "No client"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Manager and members
                    </dt>
                    <dd className="mt-1">
                      {selected.managerName} · {selected.memberCount} employees
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Members</dt>
                    <dd className="mt-1">
                      {selected.members.map((member) => member.name).join(", ")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelected(null);
                      setEditing(selected);
                    }}
                  >
                    Edit work group
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent
          title={editing === "new" ? "Create work group" : "Edit work group"}
          description="Choose a manager and employees for this group."
        >
          {editing ? (
            <div className="pt-1">
              <WorkGroupForm
                workGroup={editing === "new" ? undefined : editing}
                employees={employees}
                clientOptions={clientOptions}
                onClose={() => setEditing(null)}
                onSubmit={saveWorkGroup}
              />
              {saving ? <p className="mt-3 text-sm text-muted-foreground">Saving work group...</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
