"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, MoreHorizontal, Plus } from "lucide-react";
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
  getClient,
  listClientContacts,
  listClients,
  listEngagements,
  listWorkGroups,
} from "@/features/administration/api/administration-api";
import { clients, managers } from "@/mocks/administration";
import {
  clientContactInputSchema,
  type Client,
  type ClientContact,
  type ClientContactInput,
  type ClientListRequest,
  type WorkGroup,
  type WorkGroupInput,
  workGroupInputSchema,
} from "@/types/administration";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
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
            <dt className="text-muted-foreground">Delivery health</dt>
            <dd className="mt-0.5">
              <StatusBadge status={client.deliveryHealth} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Outstanding</dt>
            <dd className="mt-0.5 font-medium">
              {money.format(client.outstandingAmount)}
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
  const request = useMemo<ClientListRequest>(
    () => ({
      query: searchParams.get("query") ?? undefined,
      status: searchParams.get("status") as ClientListRequest["status"],
      service: searchParams.get("service") ?? undefined,
      manager: searchParams.get("manager") ?? undefined,
      deliveryHealth: searchParams.get(
        "health",
      ) as ClientListRequest["deliveryHealth"],
      balance: searchParams.get("balance") as ClientListRequest["balance"],
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
  const setParam = (key: string, value: string) =>
    updateUrl(pathname, new URLSearchParams(searchParams), router, key, value);
  const activeFilterCount = [
    request.query,
    request.status,
    request.service,
    request.manager,
    request.deliveryHealth,
    request.balance && request.balance !== "any" ? request.balance : undefined,
    request.deadline && request.deadline !== "any"
      ? request.deadline
      : undefined,
  ].filter(Boolean).length;
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
      id: "health",
      header: "Delivery health",
      cell: ({ row }) => <StatusBadge status={row.original.deliveryHealth} />,
    },
    {
      id: "balance",
      header: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1"
          onClick={() =>
            setParam("sort", request.sort === "balance" ? "name" : "balance")
          }
        >
          Outstanding <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </button>
      ),
      cell: ({ row }) => money.format(row.original.outstandingAmount),
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
      />
      <Card>
        <CardHeader>
          <CardTitle>Client directory</CardTitle>
          <CardDescription>
            Shareable filters and pagination are ready for a tenant-scoped API.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FilterToolbar
            search={{
              value: request.query ?? "",
              onChange: (value) => setParam("query", value),
              label: "Search clients",
              placeholder: "Search client, code, or primary contact",
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
                <option value="balance">Outstanding</option>
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
                <option value="archived">Archived</option>
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
                <option value="Tax compliance">Tax compliance</option>
                <option value="Accounting">Accounting</option>
                <option value="Advisory">Advisory</option>
                <option value="Payroll">Payroll</option>
                <option value="Legal compliance">Legal compliance</option>
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
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.name}>
                    {manager.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Delivery health
              <Select
                aria-label="Filter delivery health"
                value={request.deliveryHealth ?? ""}
                onChange={(event) => setParam("health", event.target.value)}
              >
                <option value="">All health states</option>
                <option value="healthy">Healthy</option>
                <option value="watch">Watch</option>
                <option value="at-risk">At risk</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Outstanding balance
              <Select
                aria-label="Filter outstanding balance"
                value={request.balance ?? "any"}
                onChange={(event) => setParam("balance", event.target.value)}
              >
                <option value="any">Any balance</option>
                <option value="outstanding">Outstanding</option>
                <option value="clear">Clear</option>
              </Select>
            </label>
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
    </div>
  );
}

function ContactForm({
  contact,
  onSave,
}: {
  contact?: ClientContact;
  onSave: () => void;
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
        <Button type="submit">Validate contact</Button>
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

export function ClientDetail({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "overview");
  const [editingContact, setEditingContact] = useState<
    ClientContact | "new" | null
  >(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientContact | null>(
    null,
  );
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const contactsQuery = useQuery({
    queryKey: ["client-contacts", clientId],
    queryFn: listClientContacts,
  });
  const engagementsQuery = useQuery({
    queryKey: ["engagements", clientId],
    queryFn: listEngagements,
  });
  const groupsQuery = useQuery({
    queryKey: ["work-groups", clientId],
    queryFn: listWorkGroups,
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
  const contacts = (contactsQuery.data ?? []).map((contact) => ({
    ...contact,
    status: archivedIds.has(contact.id)
      ? ("archived" as const)
      : contact.status,
  }));
  const panel =
    tab === "overview" ? (
      <section className="grid gap-[30px] xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Delivery overview</CardTitle>
            <CardDescription>
              Client health, current services, managers, tasks, and deadlines.
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
              <p className="text-sm text-muted-foreground">Delivery health</p>
              <div className="mt-1">
                <StatusBadge status={client.deliveryHealth} />
              </div>
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
            <CardTitle>Onboarding and document completion</CardTitle>
            <CardDescription>
              Progress makes missing setup visible without scoring people.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ProgressRow
              label="Client onboarding"
              value={client.onboardingProgress}
            />
            <ProgressRow
              label="Required documents"
              value={client.documentProgress}
            />
            <p className="text-sm text-muted-foreground">
              Internal profitability is intentionally not exposed in this Tenant
              Admin mock without a dedicated server-enforced permission.
            </p>
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
          {contactsQuery.isPending ? (
            <LoadingState label="Loading client contacts" rows={2} />
          ) : (
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
          {engagementsQuery.isPending ? (
            <LoadingState label="Loading service engagements" rows={2} />
          ) : (
            <div className="grid gap-5">
              {(engagementsQuery.data ?? []).map((engagement) => (
                <article
                  key={engagement.id}
                  className="border-b pb-5 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="font-medium">{engagement.name}</p>
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
          {groupsQuery.isPending ? (
            <LoadingState label="Loading work groups" rows={2} />
          ) : (
            <ul className="flex flex-col divide-y">
              {(groupsQuery.data ?? [])
                .filter((group) => group.client === client.name)
                .map((group) => (
                  <li
                    key={group.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{group.name}</p>
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
          <p className="text-sm text-muted-foreground">
            {client.openTasks} active client tasks; {client.atRiskTasks} need
            attention. Use Tasks to view assignees and work logs.
          </p>
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
          <p className="text-sm">
            <strong>{money.format(client.outstandingAmount)}</strong>{" "}
            outstanding across current invoices.
          </p>
        </CardContent>
      </Card>
    ) : tab === "agreements" ? (
      <Card>
        <CardHeader>
          <CardTitle>Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            One active agreement is available for the current services. Document
            download requires the tenant-scoped document permission.
          </p>
        </CardContent>
      </Card>
    ) : tab === "documents" ? (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressRow
            label="Required document completion"
            value={client.documentProgress}
          />
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>Client activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4 text-sm">
            <li>Client contact confirmed delivery dates · Today</li>
            <li>Manager updated the engagement milestone · Yesterday</li>
            <li>Required document request sent · Jul 18</li>
          </ol>
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
          description="Validate contact details before the future tenant-scoped API persists them."
        >
          <ContactForm
            contact={
              editingContact === "new"
                ? undefined
                : (editingContact ?? undefined)
            }
            onSave={() => setEditingContact(null)}
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
        onConfirm={() => {
          if (archiveTarget)
            setArchivedIds((current) => new Set(current).add(archiveTarget.id));
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}

function WorkGroupForm({
  workGroup,
  onClose,
  onSubmit,
}: {
  workGroup?: WorkGroup;
  onClose: () => void;
  onSubmit: (values: WorkGroupInput) => void;
}) {
  const form = useForm<WorkGroupInput>({
    resolver: zodResolver(workGroupInputSchema),
    defaultValues: workGroup
      ? {
          name: workGroup.name,
          client: workGroup.client,
          engagement: workGroup.engagement,
          manager: workGroup.manager,
          members: workGroup.members,
          capacityPercent: workGroup.capacityPercent,
          workloadPercent: workGroup.workloadPercent,
          openTasks: workGroup.openTasks,
          slaStatus: workGroup.slaStatus,
          status: workGroup.status,
        }
      : {
          name: "",
          client: clients[0]?.name ?? "",
          engagement: "",
          manager: managers[0]?.name ?? "",
          members: 1,
          capacityPercent: 100,
          workloadPercent: 0,
          openTasks: 0,
          slaStatus: "on-track",
          status: "active",
        },
  });
  return (
    <form
      className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-2"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Work-group name
          <Input className="mt-1" {...form.register("name")} />
          {form.formState.errors.name ? (
            <span className="mt-1 block text-xs text-danger">
              {form.formState.errors.name.message}
            </span>
          ) : null}
        </label>
        <label className="text-sm font-medium">
          Client
          <Select className="mt-1" {...form.register("client")}>
            {clients.map((client) => (
              <option key={client.id} value={client.name}>
                {client.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-medium">
          Service engagement
          <Input className="mt-1" {...form.register("engagement")} />
        </label>
        <label className="text-sm font-medium">
          Manager
          <Select className="mt-1" {...form.register("manager")}>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.name}>
                {manager.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm font-medium">
          Members
          <Input
            type="number"
            min="0"
            className="mt-1"
            {...form.register("members", { valueAsNumber: true })}
          />
        </label>
        <label className="text-sm font-medium">
          Capacity percentage
          <Input
            type="number"
            min="0"
            max="200"
            className="mt-1"
            {...form.register("capacityPercent", { valueAsNumber: true })}
          />
        </label>
        <label className="text-sm font-medium">
          Workload percentage
          <Input
            type="number"
            min="0"
            max="100"
            className="mt-1"
            {...form.register("workloadPercent", { valueAsNumber: true })}
          />
        </label>
        <label className="text-sm font-medium">
          Open tasks
          <Input
            type="number"
            min="0"
            className="mt-1"
            {...form.register("openTasks", { valueAsNumber: true })}
          />
        </label>
        <label className="text-sm font-medium">
          SLA status
          <Select className="mt-1" {...form.register("slaStatus")}>
            <option value="on-track">On track</option>
            <option value="watch">Watch</option>
            <option value="at-risk">At risk</option>
          </Select>
        </label>
        <label className="text-sm font-medium">
          Status
          <Select className="mt-1" {...form.register("status")}>
            <option value="active">Active</option>
            <option value="on-hold">On hold</option>
            <option value="complete">Complete</option>
          </Select>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
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
  const groupsQuery = useQuery({
    queryKey: ["work-groups"],
    queryFn: listWorkGroups,
  });
  const [selected, setSelected] = useState<WorkGroup | null>(null);
  const [editing, setEditing] = useState<WorkGroup | "new" | null>(null);
  const [localGroups, setLocalGroups] = useState<WorkGroup[]>([]);
  if (groupsQuery.isPending)
    return <LoadingState label="Loading work groups" rows={4} />;
  if (groupsQuery.isError)
    return (
      <ErrorState
        title="Work groups could not load"
        onRetry={() => void groupsQuery.refetch()}
      />
    );
  const sourceGroups = groupsQuery.data ?? [];
  const changes = new Map(localGroups.map((group) => [group.id, group]));
  const groups = [
    ...sourceGroups.map((group) => changes.get(group.id) ?? group),
    ...localGroups.filter(
      (group) => !sourceGroups.some((source) => source.id === group.id),
    ),
  ];
  const saveWorkGroup = (values: WorkGroupInput) => {
    const workGroup: WorkGroup = {
      id:
        editing && editing !== "new"
          ? editing.id
          : `mock-work-group-${Date.now()}`,
      ...values,
    };
    setLocalGroups((current) => {
      const exists = current.some((group) => group.id === workGroup.id);
      return exists
        ? current.map((group) =>
            group.id === workGroup.id ? workGroup : group,
          )
        : [...current, workGroup];
    });
    setEditing(null);
  };
  const columns: ColumnDef<WorkGroup>[] = [
    { accessorKey: "name", header: "Work group" },
    { accessorKey: "client", header: "Client" },
    { accessorKey: "engagement", header: "Service engagement" },
    { accessorKey: "manager", header: "Manager" },
    {
      id: "capacity",
      header: "Capacity / workload",
      cell: ({ row }) =>
        `${row.original.capacityPercent}% / ${row.original.workloadPercent}%`,
    },
    { accessorKey: "openTasks", header: "Open tasks" },
    {
      id: "sla",
      header: "SLA",
      cell: ({ row }) => <StatusBadge status={row.original.slaStatus} />,
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
            Validated changes are retained in this mock session until the
            tenant-scoped work-group mutation API is connected.
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
                identifier={group.engagement}
                status={<StatusBadge status={group.slaStatus} />}
                metadata={
                  <>
                    <div>
                      <dt className="text-muted-foreground">Client</dt>
                      <dd className="mt-0.5">{group.client}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Manager</dt>
                      <dd className="mt-0.5">{group.manager}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Workload</dt>
                      <dd className="mt-0.5">{group.workloadPercent}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Open tasks</dt>
                      <dd className="mt-0.5">{group.openTasks}</dd>
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
          description="Capacity and delivery context for the selected work group."
        >
          <div className="pr-8">
            {selected ? (
              <>
                <h2 className="font-semibold">{selected.name}</h2>
                <dl className="mt-5 grid gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      Client and engagement
                    </dt>
                    <dd className="mt-1">
                      {selected.client} · {selected.engagement}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Manager and members
                    </dt>
                    <dd className="mt-1">
                      {selected.manager} · {selected.members} members
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Capacity and workload
                    </dt>
                    <dd className="mt-1">
                      {selected.capacityPercent}% capacity ·{" "}
                      {selected.workloadPercent}% allocated
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">SLA and status</dt>
                    <dd className="mt-1">
                      <StatusBadge status={selected.slaStatus} />
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
          description="Validate the delivery group before saving this mock-only change."
        >
          <div className="pr-8">
            <h2 className="font-semibold">
              {editing === "new" ? "Create work group" : "Edit work group"}
            </h2>
            {editing ? (
              <div className="mt-5">
                <WorkGroupForm
                  workGroup={editing === "new" ? undefined : editing}
                  onClose={() => setEditing(null)}
                  onSubmit={saveWorkGroup}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
