"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Landmark, ListChecks } from "lucide-react";
import { getOperationalWorkspace } from "@/features/operations/api/operations-api";
import {
  ClientDeliverables,
  ClientOnboarding,
} from "@/components/operations/gamification-workflows";
import { SupportTicketWorkspace } from "@/components/operations/support-ticket-workspace";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
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
import type { ClientRequest } from "@/types/operations";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export function ClientPortal({
  section = "overview",
}: {
  section?:
    | "overview"
    | "services"
    | "requests"
    | "support"
    | "notifications"
    | "profile"
    | "onboarding"
    | "deliverables";
}) {
  const query = useQuery({
    queryKey: ["client-portal"],
    queryFn: () => getOperationalWorkspace("client"),
  });
  if (query.isPending)
    return <LoadingState label="Loading client portal" rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        title="Client portal could not load"
        onRetry={() => void query.refetch()}
      />
    );
  const data = query.data;
  if (section === "onboarding") return <ClientOnboarding />;
  if (section === "deliverables") return <ClientDeliverables />;
  if (section === "support") return <SupportTicketWorkspace workspace="client" />;
  if (section === "requests") return <ClientRequests requests={data.requests} />;
  if (section === "services")
    return <ClientServices tasks={data.tasks} milestones={data.milestones} />;
  if (section === "notifications" || section === "profile")
    return <ClientInfo section={section} />;
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Service overview"
        description="Your active services, requests, invoices, and shared documents."
      />
      <section
        className="grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Client service metrics"
      >
        {[
          {
            label: "Active services",
            value: String(
              new Set(data.tasks.map((task) => task.engagement)).size,
            ),
          },
          {
            label: "Service progress",
            value: `${Math.round((data.tasks.reduce((value, task) => value + task.checklist.filter((item) => item.complete).length / task.checklist.length, 0) / data.tasks.length) * 100)}%`,
          },
          {
            label: "Open requests",
            value: String(
              data.requests.filter((request) => request.status !== "resolved")
                .length,
            ),
          },
          {
            label: "Outstanding invoices",
            value: rupees.format(
              data.invoices.reduce(
                (value, invoice) => value + invoice.amount - invoice.paidAmount,
                0,
              ),
            ),
          },
        ].map((metric) => (
          <MetricCard
            key={metric.label}
            metric={metric}
            className="rounded-none border-y-0 border-l-0 shadow-none last:border-r-0"
          />
        ))}
      </section>
      <section className="grid gap-[30px] lg:grid-cols-2">
        <ClientServices
          tasks={data.tasks}
          milestones={data.milestones}
          compact
        />
        <Card>
          <CardHeader>
            <CardTitle>Pending client actions</CardTitle>
            <CardDescription>
              Requests and documents that need your response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {data.requests.map((request) => (
                <li
                  key={request.id}
                  className="flex items-start justify-between gap-3 py-4 first:pt-0"
                >
                  <div>
                    <p className="font-medium">{request.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Updated {request.updatedOn}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      request.status === "resolved"
                        ? "complete"
                        : request.status === "in-progress"
                          ? "on-track"
                          : "pending"
                    }
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
function ClientServices({
  tasks,
  milestones,
  compact = false,
}: {
  tasks: Array<{
    id: string;
    engagement: string;
    title: string;
    dueDate: string;
    checklist: Array<{ complete: boolean }>;
  }>;
  milestones: Array<{
    id: string;
    label: string;
    date: string;
    complete: boolean;
  }>;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-[18px] text-primary" />
          Active services
        </CardTitle>
        <CardDescription>
          Service progress is based on delivery checkpoints, not internal
          employee activity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {tasks.map((task) => (
            <li key={task.id} className="py-4 first:pt-0">
              <p className="font-medium">{task.engagement}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {task.title} · next date {task.dueDate}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {task.checklist.filter((item) => item.complete).length}/
                {task.checklist.length} delivery checkpoints complete
              </p>
            </li>
          ))}
        </ul>
        {!compact ? (
          <ul className="mt-5 flex flex-col gap-2 text-sm">
            {milestones.map((milestone) => (
              <li key={milestone.id}>
                {milestone.complete ? "Complete" : "Upcoming"}:{" "}
                {milestone.label} · {milestone.date}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
function ClientRequests({ requests }: { requests: ClientRequest[] }) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title="Requests"
        description="Track requests for your client account only."
      />
      <Card>
        <CardContent className="pt-[30px]">
          {requests.length ? (
            <ul className="flex flex-col divide-y">
              {requests.map((request) => (
                <li key={request.id} className="py-4 first:pt-0">
                  <p className="font-medium">{request.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.status.replaceAll("-", " ")} · {request.updatedOn}{" "}
                    · {request.owner}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No requests"
              description="Create a request when you need a delivery update."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function ClientInfo({ section }: { section: "notifications" | "profile" }) {
  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeader
        eyebrow="Client portal"
        title={section === "profile" ? "Profile" : "Notifications"}
        description={
          section === "profile"
            ? "Your authorised client contact details."
            : "Updates about your active services and requests."
        }
      />
      <Card>
        <CardContent className="pt-[30px]">
          <p className="font-medium">
            {section === "profile"
              ? "Taylor Morgan"
              : "A delivery meeting is awaiting confirmation"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {section === "profile"
              ? "Primary client contact for Northstar Labs"
              : "Confirm the proposed meeting time from your requests page."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
