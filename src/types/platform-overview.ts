import type { Metric, Status } from "@/types/domain";

export type PlatformMetric = Metric;
export type TenantHealthRow = {
  name: string;
  users: number;
  status: Status;
  detail: string;
};
export type PlatformActivity = { title: string; detail: string; time: string };
export type PlatformAlert = { title: string; detail: string; status: Status };
export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  status: Status;
};

export type PlatformOverview = {
  metrics: PlatformMetric[];
  tenantHealth: TenantHealthRow[];
  recentActivity: PlatformActivity[];
  alerts: PlatformAlert[];
  auditEvents: AuditEvent[];
};
