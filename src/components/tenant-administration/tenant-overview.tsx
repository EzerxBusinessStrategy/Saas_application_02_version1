"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  administrationOverview,
  clients,
  workGroups,
} from "@/mocks/administration";
import { tasks } from "@/mocks/workspaces";

export function TenantAdministrationOverview() {
  const { data } = useQuery({
    queryKey: ["tenant-operations-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/operations-overview", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load operations overview");
      return res.json();
    },
    staleTime: 10000,
  });

  const defaultRealMetrics = [
    { label: "Active clients", value: "0", change: "0 active clients", trend: "flat" as const },
    { label: "Total sales", value: "$0", change: "$0 recorded sales", trend: "flat" as const },
    { label: "Open tasks", value: "0", change: "0 overdue", trend: "flat" as const },
    { label: "SLA compliance", value: "0%", change: "Target 95%+", trend: "flat" as const },
    { label: "Employee utilisation", value: "0%", change: "0 active staff", trend: "flat" as const },
    { label: "Outstanding invoices", value: "$0", change: "$0 outstanding", trend: "flat" as const },
  ];

  const metrics = data?.metrics || defaultRealMetrics;

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Operations overview"
        description="Monitor client delivery, workforce capacity, billing follow-up, and organisation readiness."
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Tenant administration metrics"
      >
        {metrics.map((metric: any) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle
                className="size-[18px] text-warning"
                aria-hidden="true"
              />
              At-risk work and deadlines
            </CardTitle>
            <CardDescription>
              Delivery signals that need a manager or administrator response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {clients
                .filter((client) => client.deliveryHealth !== "healthy")
                .map((client) => (
                  <li
                    key={client.id}
                    className="flex items-start justify-between gap-3 py-4 first:pt-0"
                  >
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {client.atRiskTasks} at-risk tasks
                        {client.upcomingDeadline
                          ? ` · deadline ${client.upcomingDeadline}`
                          : " · no upcoming deadline"}
                      </p>
                    </div>
                    <StatusBadge status={client.deliveryHealth} />
                  </li>
                ))}
              {workGroups
                .filter((group) => group.slaStatus === "at-risk")
                .map((group) => (
                  <li
                    key={group.id}
                    className="flex items-start justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {group.workloadPercent}% workload · {group.openTasks}{" "}
                        open tasks
                      </p>
                    </div>
                    <StatusBadge status={group.slaStatus} />
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2
                className="size-[18px] text-primary"
                aria-hidden="true"
              />
              Organisation setup
            </CardTitle>
            <CardDescription>
              Complete operational setup tasks before expanding delivery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {administrationOverview.onboarding.map((item) => (
                <li key={item.label}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{item.value}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-control)] bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted-foreground">
              Progress is operational visibility only: it does not score
              employees, revenue, or overdue debt.
            </p>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-[30px] lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock
                className="size-[18px] text-primary"
                aria-hidden="true"
              />
              Upcoming deadlines
            </CardTitle>
            <CardDescription>
              Client milestones and operational follow-ups in the next delivery
              window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {tasks.slice(0, 3).map((task) => (
                <li key={task.id} className="py-3 first:pt-0">
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {task.client} · due {task.due}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Changes requiring a traceable follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-4 text-sm">
              <li>
                <strong>Priya Nair</strong> allocated an Accounts work group ·
                12 minutes ago
              </li>
              <li>
                <strong>Wellspring Co.</strong> uploaded requested source
                documents · 48 minutes ago
              </li>
              <li>
                <strong>Aarav Mehta</strong> marked a GST milestone ready for
                review · 2 hours ago
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
