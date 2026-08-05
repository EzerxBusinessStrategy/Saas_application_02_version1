"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
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

type EmployeeRef = {
  id: string;
  name: string;
  role: string;
  status: string;
};

type Money = {
  amount: string;
  currencyCode: string;
};

type ScoreComponents = {
  taskScore: number | null;
  slaScore: number | null;
  revenueScore: number | null;
};

type EmployeePerformanceItem = {
  rank: number | null;
  employee: EmployeeRef;
  clientsServed: number;
  totalAssignedTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  cancelledTasks: number;
  completionRatePercent: number | null;
  onTimeCompletionRatePercent: number | null;
  averageSlaMinutes: number | null;
  medianSlaMinutes: number | null;
  slaEfficiencyRatio: number | null;
  slaUnavailableReason: string | null;
  slaMetRatePercent: number | null;
  revenueContribution: Money | null;
  revenueUnavailableReason: string | null;
  performanceScore: number | null;
  scoreComponents: ScoreComponents;
  availableComponents: string[];
  isEligibleForRanking: boolean;
  eligibilityReason: string | null;
};

type PerformanceResponse = {
  period: {
    from: string;
    to: string;
    label: string;
  };
  summary: {
    eligibleEmployees: number;
    tenantAverageSlaMinutes: number | null;
    tenantTaskCompletionRatePercent: number | null;
    tenantOnTimeCompletionRatePercent: number | null;
    topEmployeeId: string | null;
  };
  items: EmployeePerformanceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ClientBreakdown = {
  clientId: string;
  clientName: string;
  assignedTasks: number;
  completedTasks: number;
  completionRatePercent: number | null;
  onTimeCompletionRatePercent: number | null;
  averageSlaMinutes: number | null;
  slaEfficiencyRatio: number | null;
  slaMetRatePercent: number | null;
  revenueContribution: Money | null;
};

type TaskHistoryItem = {
  taskId: string;
  title: string;
  clientName: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  allowedSlaMinutes: number | null;
  actualSlaMinutes: number | null;
  slaStatus: string;
  revenueContribution: Money | null;
};

type EmployeeDetailResponse = {
  period: { from: string; to: string; label: string };
  performance: EmployeePerformanceItem;
  clientBreakdown: ClientBreakdown[];
  taskHistory: TaskHistoryItem[];
};

function formatSlaMinutes(minutes: number | null): string {
  if (minutes === null) return "Not available";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatMoney(money: Money | null): string {
  if (!money) return "Not available";
  const num = Number(money.amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: money.currencyCode,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${money.currencyCode} ${num.toFixed(0)}`;
  }
}

export function TenantEmployeePerformancePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState("performanceScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const queryKey = ["tenant-employee-performance", { statusFilter, sortBy, sortOrder, page }];

  const { data, isLoading, isError, refetch } = useQuery<PerformanceResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/tenant-admin/employee-performance?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load employee performance");
      return res.json();
    },
    staleTime: 10000,
  });

  const detailQuery = useQuery<EmployeeDetailResponse>({
    queryKey: ["tenant-employee-performance-detail", selectedEmployeeId],
    queryFn: async () => {
      if (!selectedEmployeeId) throw new Error("No employee selected");
      const res = await fetch(`/api/tenant-admin/employee-performance/${selectedEmployeeId}`);
      if (!res.ok) throw new Error("Failed to load employee detail");
      return res.json();
    },
    enabled: Boolean(selectedEmployeeId),
  });

  if (isLoading) {
    return <PerformanceSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-lg font-medium text-destructive">Failed to load employee performance metrics</p>
        <p className="text-sm text-muted-foreground">Unable to query performance calculations from the server.</p>
        <Button variant="outline" onClick={() => void refetch()} className="gap-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  const { summary, period, items, pagination } = data;

  const filteredItems = items.filter((item) =>
    item.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.employee.role.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const topPerformers = items.filter((i) => i.isEligibleForRanking && i.rank !== null).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Tenant Admin · Workforce Performance"
        title="Employee Performance"
        description={`Compare employee delivery, SLA efficiency, client performance and revenue contribution for ${period.label}.`}
      />

      {/* Top Summary Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Eligible Top Performers</p>
              <p className="text-xl font-bold">{summary.eligibleEmployees}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">Tenant Avg SLA Time</p>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Lower is better</span>
              </div>
              <p className="text-xl font-bold">{formatSlaMinutes(summary.tenantAverageSlaMinutes)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tenant Completion Rate</p>
              <p className="text-xl font-bold">
                {summary.tenantTaskCompletionRatePercent !== null
                  ? `${summary.tenantTaskCompletionRatePercent}%`
                  : "Not available"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tenant On-Time Rate</p>
              <p className="text-xl font-bold">
                {summary.tenantOnTimeCompletionRatePercent !== null
                  ? `${summary.tenantOnTimeCompletionRatePercent}%`
                  : "Not available"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Top 5 Performers Section */}
      {topPerformers.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Top Performers</h2>
              <p className="text-xs text-muted-foreground">Ranked by composite task completion, SLA efficiency, and revenue contribution.</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ArrowDown className="size-3.5" />
              <span>Lower SLA time = Better performance</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {topPerformers.map((item) => (
              <Card
                key={item.employee.id}
                className="relative cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setSelectedEmployeeId(item.employee.id)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      #{item.rank}
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Score</span>
                      <p className="text-lg font-extrabold text-primary">{item.performanceScore ?? "N/A"}</p>
                    </div>
                  </div>
                  <CardTitle className="text-base font-semibold">{item.employee.name}</CardTitle>
                  <CardDescription className="text-xs">{item.employee.role}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 p-4 pt-0 text-xs">
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Completed Tasks:</span>
                    <span className="font-semibold">{item.completedTasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion Rate:</span>
                    <span className="font-semibold">{item.completionRatePercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Avg SLA Time
                      <span className="text-[10px] text-emerald-600 font-bold">(Lower=Better)</span>:
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatSlaMinutes(item.averageSlaMinutes)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-[11px] text-muted-foreground">
                    <span>Revenue:</span>
                    <span className="font-medium">{formatMoney(item.revenueContribution)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Full Employee Performance Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All Employees</CardTitle>
            <CardDescription>
              Backend-calculated employee metrics for {period.label}. Minimum 3 completed tasks required for top ranking.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus:outline-none"
              >
                <option value="active">Active Only</option>
                <option value="all">All Statuses</option>
              </select>

              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [b, o] = e.target.value.split(":");
                  setSortBy(b);
                  setSortOrder(o as "asc" | "desc");
                }}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus:outline-none"
              >
                <option value="performanceScore:desc">Sort: Highest Score</option>
                <option value="averageSla:asc">Sort: Fastest SLA (Ascending)</option>
                <option value="completionRate:desc">Sort: Task Completion Rate</option>
                <option value="revenue:desc">Sort: Revenue Contribution</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No employees found matching the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-center">Clients</th>
                    <th className="p-3 text-center">Assigned</th>
                    <th className="p-3 text-center">Completed</th>
                    <th className="p-3 text-right">Completion Rate</th>
                    <th className="p-3 text-right">
                      Avg SLA
                      <span className="block text-[10px] text-emerald-600 font-semibold">(Lower=Better)</span>
                    </th>
                    <th className="p-3 text-right">SLA Met %</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right">Score</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.employee.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedEmployeeId(item.employee.id)}
                    >
                      <td className="p-3 font-semibold">
                        {item.rank ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                            #{item.rank}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">
                        {item.employee.name}
                        {!item.isEligibleForRanking ? (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            (&lt;3 tasks completed)
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-muted-foreground">{item.employee.role}</td>
                      <td className="p-3 text-center">{item.clientsServed}</td>
                      <td className="p-3 text-center">{item.totalAssignedTasks}</td>
                      <td className="p-3 text-center">{item.completedTasks}</td>
                      <td className="p-3 text-right font-medium">
                        {item.completionRatePercent !== null ? `${item.completionRatePercent}%` : "N/A"}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatSlaMinutes(item.averageSlaMinutes)}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {item.slaMetRatePercent !== null ? `${item.slaMetRatePercent}%` : "N/A"}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {formatMoney(item.revenueContribution)}
                      </td>
                      <td className="p-3 text-right font-extrabold text-primary">
                        {item.performanceScore !== null ? item.performanceScore : "N/A"}
                      </td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total employees)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p: number) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog/Drawer */}
      <Dialog
        open={Boolean(selectedEmployeeId)}
        onOpenChange={(open) => {
          if (!open) setSelectedEmployeeId(null);
        }}
      >
        <DialogContent title="Employee Performance Details" className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          {detailQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              Loading employee details...
            </div>
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="py-12 text-center text-sm text-destructive">
              Failed to load detailed performance metrics for this employee.
            </div>
          ) : (
            <EmployeeDetailView data={detailQuery.data} onClose={() => setSelectedEmployeeId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeDetailView({
  data,
  onClose,
}: {
  data: EmployeeDetailResponse;
  onClose: () => void;
}) {
  const { performance, clientBreakdown, taskHistory } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{performance.employee.name}</h2>
            {performance.rank ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                Rank #{performance.rank}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{performance.employee.role} · Status: {performance.employee.status}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Score Breakdown Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Overall Score</p>
          <p className="text-2xl font-extrabold text-primary">{performance.performanceScore ?? "N/A"}</p>
        </Card>
        <Card className="p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Task Completion Component</p>
          <p className="text-xl font-bold">{performance.scoreComponents.taskScore ?? "N/A"}</p>
        </Card>
        <Card className="p-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">SLA Component</p>
            <span className="text-[10px] text-emerald-600 font-semibold">Lower SLA=Better</span>
          </div>
          <p className="text-xl font-bold">{performance.scoreComponents.slaScore ?? "N/A"}</p>
        </Card>
        <Card className="p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Revenue Component</p>
          <p className="text-xl font-bold">{performance.scoreComponents.revenueScore ?? "N/A"}</p>
        </Card>
      </div>

      {/* Client-wise Breakdown */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Client-wise Performance</h3>
        {clientBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">No client breakdown data available.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Client Name</th>
                  <th className="p-2 text-center">Assigned</th>
                  <th className="p-2 text-center">Completed</th>
                  <th className="p-2 text-right">Completion %</th>
                  <th className="p-2 text-right">Avg SLA Time</th>
                  <th className="p-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clientBreakdown.map((cb) => (
                  <tr key={cb.clientId}>
                    <td className="p-2 font-medium">{cb.clientName}</td>
                    <td className="p-2 text-center">{cb.assignedTasks}</td>
                    <td className="p-2 text-center">{cb.completedTasks}</td>
                    <td className="p-2 text-right">{cb.completionRatePercent}%</td>
                    <td className="p-2 text-right font-semibold text-emerald-600">
                      {formatSlaMinutes(cb.averageSlaMinutes)}
                    </td>
                    <td className="p-2 text-right">{formatMoney(cb.revenueContribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task History */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Recent Task History</h3>
        {taskHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground">No task history recorded for this period.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Task Title</th>
                  <th className="p-2">Client</th>
                  <th className="p-2">Assigned</th>
                  <th className="p-2">Completed</th>
                  <th className="p-2 text-right">Target SLA</th>
                  <th className="p-2 text-right">Actual SLA</th>
                  <th className="p-2 text-center">SLA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {taskHistory.map((t) => (
                  <tr key={t.taskId}>
                    <td className="p-2 font-medium">{t.title}</td>
                    <td className="p-2 text-muted-foreground">{t.clientName}</td>
                    <td className="p-2 text-muted-foreground">
                      {new Date(t.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "Pending"}
                    </td>
                    <td className="p-2 text-right">{formatSlaMinutes(t.allowedSlaMinutes)}</td>
                    <td className="p-2 text-right font-semibold text-emerald-600">
                      {formatSlaMinutes(t.actualSlaMinutes)}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={
                          t.slaStatus === "met"
                            ? "rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600"
                            : t.slaStatus === "breached"
                            ? "rounded-full bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600"
                            : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                        }
                      >
                        {t.slaStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <div className="h-16 w-1/3 animate-pulse rounded bg-muted" />
      <div className="grid h-24 grid-cols-4 gap-4 rounded bg-muted animate-pulse" />
      <div className="h-48 rounded bg-muted animate-pulse" />
      <div className="h-96 rounded bg-muted animate-pulse" />
    </div>
  );
}
