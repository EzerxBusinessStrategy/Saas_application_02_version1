"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ChartCard } from "@/components/dashboard/chart-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getTenantAnalytics } from "@/features/platform/api/tenant-analytics-api";
import type { TenantAnalyticsFilters } from "@/types/tenant-analytics";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function TenantAnalyticsPage() {
  const [filters, setFilters] = useState<TenantAnalyticsFilters>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useQuery({ queryKey: ["tenant-analytics", filters], queryFn: () => getTenantAnalytics(filters), placeholderData: keepPreviousData });
  const data = query.data;
  const currency = data?.selectedTenant?.currencyCode ?? "";
  const set = (next: Partial<TenantAnalyticsFilters>) => setFilters((current) => ({ ...current, ...next }));

  if (query.isLoading) return <LoadingState label="Loading tenant analytics" rows={6} />;
  if (query.isError || !data) return <ErrorState title="Tenant analytics could not load" description="Try again to retrieve the selected tenant data." onRetry={() => void query.refetch()} />;

  return <div className="super-admin-portal flex flex-col gap-[30px]">
    <PageHeader eyebrow="Super Admin" eyebrowIcon={BarChart3} title="Tenant analytics" description="Inspect financial, operational, employee, and client performance for one tenant or the platform." />
    <Card className="super-admin-surface"><CardContent className="grid gap-4 p-[30px] md:grid-cols-4" aria-busy={query.isFetching}>
      <label className="text-sm font-medium">Tenant<Select className="mt-1" value={filters.tenantId ?? ""} onChange={(event) => { setFrom(""); setTo(""); set({ tenantId: event.target.value || undefined, financialYearId: undefined, from: undefined, to: undefined }); }}><option value="">All tenants</option>{data.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}{tenant.status === "cancelled" ? " (Cancelled)" : ""}</option>)}</Select></label>
      <label className="text-sm font-medium">Financial year<Select className="mt-1" value={filters.financialYearId ?? ""} disabled={!filters.tenantId || Boolean(filters.from)} onChange={(event) => { setFrom(""); setTo(""); set({ financialYearId: event.target.value || undefined, from: undefined, to: undefined }); }}><option value="">Current FY{filters.tenantId ? "" : " per tenant"}</option>{data.financialYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</Select></label>
      <label className="text-sm font-medium">From<Input className="mt-1" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="text-sm font-medium">To<Input className="mt-1" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <div className="md:col-span-4 flex items-center gap-3"><Button type="button" disabled={Boolean(from) !== Boolean(to) || from > to} onClick={() => { if (from && to) { set({ from, to, financialYearId: undefined }); return; } void query.refetch(); }}>{query.isFetching ? "Updating analytics..." : from && to ? "Apply date range" : "Refresh analytics"}</Button>{query.isFetching ? <p role="status" className="text-sm text-muted-foreground">Updating analytics...</p> : (from || to) && <p className="text-sm text-muted-foreground">Choose both dates to apply a custom period.</p>}</div>
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Metric label="Turnover" value={money(data.metrics.turnover, currency)} /><Metric label="Collected" value={money(data.metrics.collected, currency)} /><Metric label="Outstanding" value={money(data.metrics.outstanding, currency)} /><Metric label="Tasks completed" value={`${number.format(data.metrics.completedTasks)} / ${number.format(data.metrics.totalTasks)}`} /><Metric label="SLA compliance" value={`${data.metrics.slaCompliance}%`} /></div>
    <div className="grid gap-[30px] xl:grid-cols-3"><ChartCard className="xl:col-span-2" title="Financial overview" description="Finalised invoice turnover and successful collections for the selected period.">{data.trend.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip cursor={false} /><Legend /><Line type="monotone" dataKey="turnover" name="Turnover" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No finalised invoice or payment data exists for the selected period.</div>}</ChartCard>
      <Card className="super-admin-surface"><CardHeader><CardTitle>Operational performance</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><MetricLine label="Invoices" value={number.format(data.metrics.invoices)} /><MetricLine label="Payments" value={number.format(data.metrics.payments)} /><MetricLine label="Active clients" value={number.format(data.metrics.clients)} /><MetricLine label="Active employees" value={number.format(data.metrics.activeEmployees)} /><MetricLine label="Employee completion" value={`${data.metrics.employeeCompletionRate}%`} /></CardContent></Card></div>
    <Card className="super-admin-surface"><CardHeader><CardTitle>Client and revenue analysis</CardTitle></CardHeader><CardContent>{data.clientRevenue.length ? <table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="pb-3 font-medium">Client</th><th className="pb-3 text-right font-medium">Turnover</th></tr></thead><tbody>{data.clientRevenue.map((client) => <tr key={client.clientName} className="border-b last:border-0"><td className="py-3">{client.clientName}</td><td className="py-3 text-right tabular-nums">{money(client.turnover, currency)}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">No finalised client revenue exists for the selected period.</p>}</CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <Card className="super-admin-surface"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p></CardContent></Card>; }
function MetricLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>; }
function money(value: string, currency: string) { return `${currency ? `${currency} ` : ""}${number.format(Number(value) || 0)}`; }
