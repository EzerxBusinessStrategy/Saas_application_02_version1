"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Info, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/date-picker";
import { Select } from "@/components/ui/select";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ChartCard } from "@/components/dashboard/chart-card";
import { chartAxisTick, chartTooltipCursor } from "@/components/dashboard/chart-tooltip";
import { cn } from "@/lib/utils";
import { formatIndiaDateTime } from "@/lib/india-time";
import { getSuperAdminDashboard } from "@/features/platform/api/super-admin-dashboard-api";
import type {
  DashboardHealthFilter,
  MoneyByCurrency,
  ReportingPeriodMode,
  SuperAdminDashboardData,
  SuperAdminDashboardFilters,
  TenantStatusFilter,
  TenantTurnoverHealthRow,
  TurnoverTrendPoint,
} from "@/types/platform-overview";

export function PlatformOverviewDashboard() {
  const [filters, setFilters] = useState<SuperAdminDashboardFilters>({});
  const [tenantSearch, setTenantSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const query = useQuery({
    queryKey: ["super-admin-dashboard", filters],
    queryFn: () => getSuperAdminDashboard(filters),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const data = query.data;
  const selectedTenant =
    data?.tenantHealth.find((tenant) => tenant.tenantId === selectedTenantId) ?? null;
  const tenantTrend = useMemo(
    () =>
      selectedTenant
        ? data?.turnoverTrend.filter((point) => point.tenantId === selectedTenant.tenantId) ?? []
        : [],
    [data?.turnoverTrend, selectedTenant],
  );
  const setFilter = <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) =>
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  const submitTenantSearch = () =>
    setFilters((current) => ({ ...current, search: tenantSearch.trim() || undefined }));
  if (query.isLoading) {
    return <LoadingState label="Loading Super Admin dashboard" rows={6} />;
  }

  if (!data) {
    return (
      <ErrorState
        title="Dashboard could not load"
        description="Check the backend connection and sign in again if needed."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="super-admin-portal flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Super Admin"
        eyebrowIcon={ShieldCheck}
        title="Platform overview"
        description="Tenant financial health and platform activity across every workspace."
      />

      <PlatformOverviewSection data={data} filters={filters} onFilter={setFilter} />

      <TenantTurnoverHealthSection
        data={data}
        filters={filters}
        onFilter={setFilter}
        onTenant={setSelectedTenantId}
        searchValue={tenantSearch}
        onSearchChange={setTenantSearch}
        onSearch={submitTenantSearch}
      />

      <TenantFinancialDetails
        data={data}
        filters={filters}
        selectedTenant={selectedTenant}
        selectedTenantId={selectedTenant?.tenantId ?? ""}
        tenantTrend={tenantTrend}
        onFilter={setFilter}
        onTenant={setSelectedTenantId}
      />

      <ActivityCard items={data.recentActivity} />
    </div>
  );
}

function PlatformOverviewSection({
  data,
  filters,
  onFilter,
}: {
  data: SuperAdminDashboardData;
  filters: SuperAdminDashboardFilters;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="platform-overview-title">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 id="platform-overview-title" className="text-xl font-semibold">
            Main Financial Summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Currency totals are grouped by currency and never combined.
          </p>
        </div>
        <div className="w-full md:max-w-56">
          <CountrySelect data={data} value={filters.country ?? ""} onFilter={onFilter} />
        </div>
      </div>

      <section className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          metric={{
            label: "Total tenants",
            value: formatCount(data.metrics.totalTenants),
            change: "Country scoped",
            trend: "flat",
          }}
          className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
        />
        <MoneyMetricCard label="Total turnover" amounts={data.metrics.totalTurnoverByCurrency} />
        <MoneyMetricCard label="Collected amount" amounts={data.metrics.collectedByCurrency} />
        <MoneyMetricCard label="Outstanding amount" amounts={data.metrics.outstandingByCurrency} />
        <MetricCard
          metric={{
            label: "Low-health tenants",
            value: formatCount(data.metrics.lowHealthTenants),
            change: "Financial period scoped",
            trend: data.metrics.lowHealthTenants ? "down" : "flat",
          }}
          className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
        />
      </section>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Platform Status</h2>
        <section className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Active tenants", data.platformStatus.activeTenants],
            ["Suspended tenants", data.platformStatus.suspendedTenants],
            ["Active tenant users", data.platformStatus.activeTenantUsers],
          ].map(([label, value]) => (
            <MetricCard
              key={label}
              metric={{
                label: String(label),
                value: formatCount(Number(value)),
                trend: "flat",
              }}
              className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
            />
          ))}
        </section>
      </div>
    </section>
  );
}

function MoneyMetricCard({
  label,
  amounts,
}: {
  label: string;
  amounts: readonly MoneyByCurrency[];
}) {
  return (
    <Card className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0">
      <CardContent className="p-[30px]">
        {amounts.length ? (
          <div className="flex flex-col gap-1">
            {amounts.map((item) => (
              <strong
                key={`${label}-${item.currencyCode}`}
                className="block text-[22px] leading-[28px] font-bold tracking-tight"
              >
                {formatMoney(item.amount, item.currencyCode)}
              </strong>
            ))}
          </div>
        ) : (
          <strong className="block text-[28px] leading-[34px] font-bold tracking-tight">
            No records
          </strong>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function TenantTurnoverHealthSection({
  data,
  filters,
  onFilter,
  onTenant,
  searchValue,
  onSearchChange,
  onSearch,
}: {
  data: SuperAdminDashboardData;
  filters: SuperAdminDashboardFilters;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
  onTenant: (tenantId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
}) {
  return (
    <Card className="super-admin-surface">
      <CardHeader className="gap-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              Tenant Turnover Health
              <span className="group relative inline-flex">
                <Info className="size-4 text-muted-foreground" aria-label="How tenant health is calculated" />
                <span className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-80 -translate-x-1/2 rounded-[var(--radius-card)] border bg-popover p-3 text-xs font-normal text-popover-foreground shadow-[var(--shadow-card)] group-hover:block">
                  Tenant health is calculated from finalised invoice turnover for the selected financial year or date range. Draft, cancelled and void invoices are excluded.
                </span>
              </span>
            </CardTitle>
            <CardDescription>
              Compare tenant turnover bands while keeping tenant status separate.
            </CardDescription>
          </div>
          <HealthBandLegend data={data} />
        </div>
        <TenantHealthFilters
          data={data}
          filters={filters}
          onFilter={onFilter}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onSearch={onSearch}
        />
        <HealthChips
          counts={data.filterOptions.healthCounts}
          active={filters.health ?? null}
          onSelect={(health) => onFilter("health", health ?? "")}
        />
      </CardHeader>
      <CardContent>
        {data.tenantHealth.length ? (
          <div className="flex flex-col gap-5">
            <TopTenantsByCountry tenants={data.tenantHealth} selectedCountry={filters.country ?? null} />
            <TenantHealthTable
              tenants={data.tenantHealth}
              onTenant={onTenant}
            />
          </div>
        ) : (
          <EmptyState
            title={filters.search ? `No tenant found for \"${filters.search}\"` : "No tenants match these filters"}
            description={
              filters.search
                ? "Try a different tenant name, code, or clear the search."
                : "Clear the health, status, country or search filter to expand the dashboard result."
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function TopTenantsByCountry({
  tenants,
  selectedCountry,
}: {
  tenants: readonly TenantTurnoverHealthRow[];
  selectedCountry: string | null;
}) {
  const topTenants = topTenantsByCountry(tenants);
  if (!topTenants.length) return null;

  return (
    <section className="rounded-[var(--radius-card)] border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold">
        {selectedCountry ? "Top Tenant" : "Top Performing Tenants by Country"}
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topTenants.map((tenant) => (
          <div key={tenant.country ?? tenant.tenantId} className="rounded-[var(--radius-control)] border bg-card p-3">
            <p className="text-xs text-muted-foreground">{tenant.country ?? "Country not set"}</p>
            <p className="mt-1 font-medium">{tenant.tenantName}</p>
            <p className="mt-1 text-sm tabular-nums">{formatMoney(tenant.turnover, tenant.currencyCode)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tenant.financialYear?.label ?? "Financial year not set"} - {tenant.healthLabel}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HealthBandLegend({ data }: { data: SuperAdminDashboardData }) {
  return (
    <div className="grid w-full gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:max-w-[760px] xl:grid-cols-4">
      {data.filterOptions.healthBands.map((band) => (
        <span
          key={band.code}
          className="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-center"
        >
          {band.label}: {formatMoney(String(band.minimumTurnover), null)}
          {band.maximumTurnover ? ` - ${formatMoney(String(band.maximumTurnover), null)}` : "+"}
        </span>
      ))}
    </div>
  );
}

function TenantHealthFilters({
  data,
  filters,
  onFilter,
  searchValue,
  onSearchChange,
  onSearch,
}: {
  data: SuperAdminDashboardData;
  filters: SuperAdminDashboardFilters;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
}) {
  return (
    <section className="grid gap-3 rounded-[var(--radius-card)] border bg-card p-4 md:grid-cols-2 xl:grid-cols-12">
      <div className="xl:col-span-2">
        <CountrySelect data={data} value={filters.country ?? ""} onFilter={onFilter} />
      </div>
      <div className="xl:col-span-3">
        <PeriodModeSelect value={filters.periodMode ?? "CURRENT_FY"} onFilter={onFilter} />
      </div>
      {filters.periodMode === "CUSTOM_RANGE" ? (
        <>
          <div className="xl:col-span-2">
            <DateInput label="From" value={filters.from ?? ""} onChange={(value) => onFilter("from", value)} />
          </div>
          <div className="xl:col-span-2">
            <DateInput label="To" value={filters.to ?? ""} onChange={(value) => onFilter("to", value)} />
          </div>
        </>
      ) : null}
      <label className="text-sm font-medium xl:col-span-2">
        Health
        <Select
          className="mt-1"
          value={filters.health ?? ""}
          onChange={(event) => onFilter("health", event.target.value as DashboardHealthFilter | "")}
        >
          <option value="">All Health Levels</option>
          {data.filterOptions.healthCounts
            .filter((item) => item.code)
            .map((item) => (
              <option key={item.code} value={item.code ?? ""}>
                {item.label}
              </option>
          ))}
        </Select>
      </label>
      <div className="xl:col-span-2">
        <TenantStatusSelect data={data} value={filters.tenantStatus ?? ""} onFilter={onFilter} />
      </div>
      <label className="text-sm font-medium xl:col-span-3">
        Search Tenant
        <div className="relative mt-1">
          <Input
            className="pr-10"
            value={searchValue}
            placeholder="Search tenant..."
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
            aria-label="Search tenants"
            title="Search tenants"
            onClick={onSearch}
          >
            <Search className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </label>
    </section>
  );
}

function PeriodModeSelect({
  value,
  onFilter,
}: {
  value: ReportingPeriodMode;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
}) {
  return (
    <label className="text-sm font-medium">
      Reporting Period
      <Select
        className="mt-1 min-w-0 truncate pr-10"
        value={value}
        onChange={(event) => {
          const periodMode = event.target.value as ReportingPeriodMode;
          onFilter("periodMode", periodMode);
          onFilter("financialYearId", "");
          if (periodMode !== "CUSTOM_RANGE") {
            onFilter("from", "");
            onFilter("to", "");
          }
        }}
      >
        <option value="CURRENT_FY">Current FY (per tenant)</option>
        <option value="PREVIOUS_FY">Previous FY (per tenant)</option>
        <option value="CUSTOM_RANGE">Custom date range</option>
      </Select>
    </label>
  );
}

function FinancialYearSelect({
  years,
  value,
  onFilter,
}: {
  years: SuperAdminDashboardData["filterOptions"]["financialYears"];
  value: string;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
}) {
  return (
    <label className="text-sm font-medium">
      Financial Year
      <Select
        className="mt-1"
        value={value}
        onChange={(event) => {
          onFilter("financialYearId", event.target.value);
          onFilter("periodMode", "CURRENT_FY");
          onFilter("from", "");
          onFilter("to", "");
        }}
      >
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <DatePicker className="mt-1" value={value} onChange={onChange} aria-label={label} />
    </label>
  );
}

function CountrySelect({
  data,
  value,
  onFilter,
}: {
  data: SuperAdminDashboardData;
  value: string;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
}) {
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const countries = [...new Set(data.filterOptions.countries)].sort((left, right) => {
    if (left === "IN") {
      return -1;
    }
    if (right === "IN") {
      return 1;
    }
    return formatCountryLabel(left, displayNames).localeCompare(formatCountryLabel(right, displayNames));
  });

  return (
    <label className="text-sm font-medium">
      Country
      <Select className="mt-1" value={value} onChange={(event) => onFilter("country", event.target.value)}>
        <option value="">All Countries</option>
        {countries.map((country) => (
          <option key={country} value={country}>
            {formatCountryLabel(country, displayNames)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function formatCountryLabel(countryCode: string, displayNames: Intl.DisplayNames): string {
  return displayNames.of(countryCode) ?? countryCode;
}

function TenantStatusSelect({
  data,
  value,
  onFilter,
}: {
  data: SuperAdminDashboardData;
  value: string;
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
}) {
  return (
    <label className="text-sm font-medium">
      Tenant Status
      <Select
        className="mt-1"
        value={value}
        onChange={(event) => onFilter("tenantStatus", event.target.value as TenantStatusFilter | "")}
      >
        <option value="">All Statuses</option>
        {data.filterOptions.tenantStatuses.filter((status) => status !== "pending_activation").map((status) => (
          <option key={status} value={status}>
            {titleCase(status)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function HealthChips({
  counts,
  active,
  onSelect,
}: {
  counts: readonly { code: DashboardHealthFilter | null; label: string; count: number }[];
  active: DashboardHealthFilter | null;
  onSelect: (health: DashboardHealthFilter | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {counts.map((item) => (
        <Button
          key={item.code ?? "all"}
          size="sm"
          variant={active === item.code ? "default" : "outline"}
          onClick={() => onSelect(item.code)}
        >
          {item.label} {item.count}
        </Button>
      ))}
    </div>
  );
}

function TenantHealthTable({
  tenants,
  onTenant,
}: {
  tenants: readonly TenantTurnoverHealthRow[];
  onTenant: (tenantId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Tenant turnover health</caption>
        <thead className="border-y text-sm text-muted-foreground">
          <tr>
            {["Tenant", "Country", "Currency", "Turnover", "Growth", "Health", "Status", "Action"].map(
              (heading) => (
                <th key={heading} className="px-4 py-4 font-medium" scope="col">
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.tenantId} className="border-b last:border-0">
              <td className="px-4 py-5">
                <p className="font-medium">{tenant.tenantName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatCount(tenant.activeUsers)} active users
                </p>
              </td>
              <td className="px-4 py-5">{tenant.country ?? "Not set"}</td>
              <td className="px-4 py-5">{tenant.currencyCode ?? "Not set"}</td>
              <td className="px-4 py-5 tabular-nums">{formatMoney(tenant.turnover, tenant.currencyCode)}</td>
              <td className="px-4 py-5 tabular-nums">
                {tenant.growthPercentage === null ? "Not enough data" : `${tenant.growthPercentage.toFixed(1)}%`}
              </td>
              <td className="px-4 py-5">
                <HealthBadge health={tenant.health} label={tenant.healthLabel} />
              </td>
              <td className="px-4 py-5">
                <TenantStatusBadge
                  status={tenant.tenantStatus}
                  tenantAdministratorLastLoginAt={tenant.tenantAdministratorLastLoginAt ?? null}
                />
              </td>
              <td className="px-4 py-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Actions for ${tenant.tenantName}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onTenant(tenant.tenantId)}>
                      View tenant
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantFinancialDetails({
  data,
  filters,
  selectedTenant,
  selectedTenantId,
  tenantTrend,
  onFilter,
  onTenant,
}: {
  data: SuperAdminDashboardData;
  filters: SuperAdminDashboardFilters;
  selectedTenant: TenantTurnoverHealthRow | null;
  selectedTenantId: string;
  tenantTrend: readonly TurnoverTrendPoint[];
  onFilter: <Key extends keyof SuperAdminDashboardFilters>(
    key: Key,
    value: SuperAdminDashboardFilters[Key] | "",
  ) => void;
  onTenant: (tenantId: string) => void;
}) {
  return (
    <Card className="super-admin-surface">
      <CardHeader>
        <CardTitle>Tenant Financial Details</CardTitle>
        <CardDescription>Select one tenant to inspect turnover and payment details.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section className="grid gap-3 rounded-[var(--radius-card)] border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">
            Select Tenant
            <Select
              className="mt-1"
              value={selectedTenantId}
              onChange={(event) => {
                onTenant(event.target.value);
                onFilter("financialYearId", "");
                onFilter("periodMode", "CURRENT_FY");
                onFilter("from", "");
                onFilter("to", "");
              }}
            >
              <option value="">Select a tenant</option>
              {data.tenantHealth.map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.tenantName}
                </option>
              ))}
            </Select>
          </label>
          {selectedTenant ? (
            <>
              <FinancialYearSelect
                years={selectedTenant.financialYears}
                value={filters.financialYearId ?? selectedTenant.financialYear?.id ?? ""}
                onFilter={onFilter}
              />
              <DateInput label="From" value={filters.from ?? ""} onChange={(value) => onFilter("from", value)} />
              <DateInput label="To" value={filters.to ?? ""} onChange={(value) => onFilter("to", value)} />
            </>
          ) : null}
        </section>

        {selectedTenant ? (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-lg font-semibold">{selectedTenant.tenantName}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Currency: {selectedTenant.currencyCode ?? "Not set"}
              </p>
              {selectedTenant.financialYear ? (
                <p className="mt-1 text-sm font-medium text-primary">
                  {selectedTenant.financialYear.label} - Current FY
                </p>
              ) : null}
            </div>
            <section className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                metric={{
                  label: "Total Turnover",
                  value: formatMoney(selectedTenant.turnover, selectedTenant.currencyCode),
                  trend: "flat",
                }}
                className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
              />
              <MetricCard
                metric={{
                  label: "Collected",
                  value: formatMoney(selectedTenant.collected, selectedTenant.currencyCode),
                  trend: "up",
                }}
                className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
              />
              <MetricCard
                metric={{
                  label: "Outstanding",
                  value: formatMoney(selectedTenant.outstanding, selectedTenant.currencyCode),
                  trend: moneyNumber(selectedTenant.outstanding) > 0 ? "down" : "flat",
                }}
                className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
              />
              <MetricCard
                metric={{
                  label: "Collection Rate",
                  value: `${selectedTenant.collectionRate.toFixed(1)}%`,
                  trend: "flat",
                }}
                className="super-admin-surface rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
              />
            </section>
            <TenantTurnoverTrend tenant={selectedTenant} trend={tenantTrend} />
          </div>
        ) : (
          <EmptyState
            title="Select a tenant to view turnover and payment details."
            description="Tenant-level financial cards and trend will appear here."
          />
        )}
      </CardContent>
    </Card>
  );
}

function TenantTurnoverTrend({
  tenant,
  trend,
}: {
  tenant: TenantTurnoverHealthRow;
  trend: readonly TurnoverTrendPoint[];
}) {
  const chartData = trend.map((point) => ({
    month: point.month,
    turnover: moneyNumber(point.turnover),
  }));

  return (
    <ChartCard
      title="Tenant Turnover Trend"
      description="Finalised invoice turnover for the selected tenant and period."
      className="super-admin-surface"
    >
      {chartData.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={chartAxisTick} tickLine={false} axisLine={false} />
              <YAxis
                tick={chartAxisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatMoneyShort(value, tenant.currencyCode)}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                content={<TenantTrendTooltip currencyCode={tenant.currencyCode} />}
              />
              <Bar dataKey="turnover" name="Turnover" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="No tenant turnover trend yet"
          description="Monthly turnover will appear when finalised invoices exist for this tenant."
        />
      )}
    </ChartCard>
  );
}

function TenantTrendTooltip({
  active,
  label,
  payload,
  currencyCode,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number }>;
  currencyCode: string | null;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="min-w-32 rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-[var(--shadow-card)]">
      <p className="mb-1 font-medium">{label}</p>
      <p className="tabular-nums">{formatMoney(String(value), currencyCode)}</p>
    </div>
  );
}

function ActivityCard({
  items,
}: {
  items: readonly { id: string; title: string; description: string; occurredAt: string }[];
}) {
  return (
    <Card className="super-admin-surface">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-[18px] text-primary" aria-hidden="true" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest important platform events.</CardDescription>
          </div>
          <Link
            className="inline-flex min-h-8 items-center justify-center rounded-[var(--radius-control)] border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-[0_1px_1px_rgb(0_0_0/0.05)] transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/super-admin/audit-log"
          >
            View full audit log
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ol className="flex flex-col gap-4">
            {items.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatIndiaDateTime(item.occurredAt)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No recent activity" description="Platform events will appear here." />
        )}
      </CardContent>
    </Card>
  );
}

function HealthBadge({ health, label }: { health: DashboardHealthFilter; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
        health === "HIGH_PERFORMING" && "border-emerald-700/30 bg-emerald-700/10 text-emerald-800",
        health === "HEALTHY" && "border-sky-700/30 bg-sky-700/10 text-sky-800",
        health === "DEVELOPING" && "border-amber-700/30 bg-amber-700/10 text-amber-800",
        health === "LOW" && "border-red-700/30 bg-red-700/10 text-red-800",
      )}
    >
      {label}
    </span>
  );
}

function TenantStatusBadge({
  status,
  tenantAdministratorLastLoginAt,
}: {
  status: string;
  tenantAdministratorLastLoginAt: string | null;
}) {
  const displayStatus = (status === "active" || status === "pending_activation") && !tenantAdministratorLastLoginAt
    ? "not_logged_in"
    : status;
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
        displayStatus === "active" && "border-emerald-700/30 bg-emerald-700/10 text-emerald-800",
        displayStatus === "suspended" && "border-red-700/30 bg-red-700/10 text-red-800",
        displayStatus !== "active" && displayStatus !== "suspended" && "border-slate-700/30 bg-slate-700/10 text-slate-700",
      )}
    >
      {titleCase(displayStatus)}
    </span>
  );
}

function formatMoney(amount: string, currencyCode: string | null): string {
  const value = moneyNumber(amount);
  if (!currencyCode) {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatMoneyShort(value: number, currencyCode: string | null): string {
  const prefix = currencyCode ? `${currencyCode} ` : "";
  if (value >= 10000000) return `${prefix}${Math.round(value / 10000000)}Cr`;
  if (value >= 100000) return `${prefix}${Math.round(value / 100000)}L`;
  return `${prefix}${Math.round(value / 1000)}k`;
}

function moneyNumber(value: string | number): number {
  return Number(value) || 0;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function topTenantsByCountry(tenants: readonly TenantTurnoverHealthRow[]): readonly TenantTurnoverHealthRow[] {
  const topByCountry = new Map<string, TenantTurnoverHealthRow>();
  for (const tenant of tenants) {
    const country = tenant.country ?? "ZZ";
    const current = topByCountry.get(country);
    if (!current || moneyNumber(tenant.turnover) > moneyNumber(current.turnover)) {
      topByCountry.set(country, tenant);
    }
  }
  return [...topByCountry.values()].sort((left, right) => (left.country ?? "").localeCompare(right.country ?? ""));
}
