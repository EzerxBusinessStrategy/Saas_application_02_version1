import { Activity, ArrowRight, CircleAlert, Clock3 } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlatformOverviewDashboard } from "@/components/dashboard/platform-overview-dashboard";
import { TenantAdministrationOverview } from "@/components/tenant-administration/tenant-overview";
import { ClientPortal } from "@/components/operations/client-portal";
import { EmployeeWorkspace } from "@/components/operations/employee-workspace";
import { ManagerWorkspace } from "@/components/operations/manager-workspace";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { tasks, workspaceConfig } from "@/mocks/workspaces";
import type { Workspace } from "@/types/domain";

export function Dashboard({ workspace }: { workspace: Workspace }) {
  if (workspace === "super-admin")
    return <PlatformOverviewDashboard />;
  const config = workspaceConfig(workspace);
  if (workspace === "admin") return <TenantAdministrationOverview />;
  if (workspace === "manager") return <ManagerWorkspace />;
  if (workspace === "employee") return <EmployeeWorkspace />;
  if (workspace === "client") return <ClientPortal />;
  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">
            {workspace === "employee"
              ? "Tuesday, July 21"
              : "Workspace overview"}
          </p>
          <h1 className="mt-1 text-[28px] leading-[34px] font-bold tracking-tight">
            {config.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{config.subtitle}</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
          href={`/${workspace}/tasks`}
        >
          View all work <ArrowRight className="size-4" />
        </Link>
      </div>
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Key performance indicators"
      >
        {config.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] lg:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              {workspace === "employee"
                ? "Today's priorities"
                : "Delivery pulse"}
            </CardTitle>
            <CardDescription>Work that needs attention next</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y">
              {tasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 py-4 first:pt-0"
                >
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {task.client} · due {task.due}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.blocked ? (
                      <CircleAlert
                        className="size-4 text-danger"
                        aria-label="Blocked"
                      />
                    ) : null}
                    <StatusBadge
                      status={
                        task.status === "Done"
                          ? "complete"
                          : task.blocked
                            ? "blocked"
                            : task.status === "Review"
                              ? "pending"
                              : "on-track"
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-[30px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-[18px] text-primary" />
                Capacity
              </CardTitle>
              <CardDescription>Planned versus available hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-3 overflow-hidden rounded-[var(--radius-control)] bg-muted">
                <div className="h-full w-[72%] rounded-[var(--radius-control)] bg-primary" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                <strong className="text-foreground">72%</strong> of planned
                capacity is allocated this week.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="size-[18px] text-primary" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-sm">
                <li>
                  <strong>Riley</strong> submitted a work update · 12m ago
                </li>
                <li>
                  <strong>Avery</strong> approved June hours · 1h ago
                </li>
                <li>
                  <strong>Northstar Labs</strong> viewed a document · 3h ago
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
