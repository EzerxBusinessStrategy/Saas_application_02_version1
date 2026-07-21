import type { PlatformOverview } from "@/types/platform-overview";

export const platformOverview: PlatformOverview = {
  metrics: [
    {
      label: "Total tenants",
      value: "52",
      trend: "up",
      change: "+4 this month",
    },
    {
      label: "Active tenants",
      value: "48",
      trend: "up",
      change: "92% of total",
    },
    {
      label: "Suspended tenants",
      value: "4",
      trend: "down",
      change: "2 require review",
    },
    {
      label: "Tenant reviews",
      value: "3",
      trend: "up",
      change: "Due this week",
    },
    {
      label: "Active platform users",
      value: "2,843",
      trend: "up",
      change: "+8.1%",
    },
  ],
  tenantHealth: [
    {
      name: "Northstar Labs",
      users: 184,
      status: "on-track",
      detail: "Usage and delivery operations healthy",
    },
    {
      name: "Wellspring Co.",
      users: 126,
      status: "pending",
      detail: "Tenant administration review due in 12 days",
    },
    {
      name: "Bayside Health",
      users: 97,
      status: "at-risk",
      detail: "Low adoption in two work groups",
    },
    {
      name: "Harbor & Finch",
      users: 64,
      status: "blocked",
      detail: "Delivery capacity requires attention",
    },
  ],
  recentActivity: [
    {
      title: "New tenant provisioned",
      detail: "Aster Studio tenant workspace activated",
      time: "12 min ago",
    },
    {
      title: "Tenant configuration updated",
      detail: "Northstar Labs updated its workspace configuration",
      time: "48 min ago",
    },
    {
      title: "Tenant administrator invited",
      detail: "Wellspring Co. added a finance administrator",
      time: "2 h ago",
    },
    {
      title: "Tenant access review completed",
      detail: "Bayside Health access was reviewed for continued operation",
      time: "5 h ago",
    },
  ],
  alerts: [
    {
      title: "Tenant support review needed",
      detail: "Harbor & Finch has delivery capacity requiring attention",
      status: "blocked",
    },
    {
      title: "Employee allocation nearing capacity",
      detail:
        "Northstar Labs has limited availability across active work groups",
      status: "at-risk",
    },
    {
      title: "Tenant administrator review due",
      detail: "Wellspring Co. needs an administrator access review in 12 days",
      status: "pending",
    },
  ],
  auditEvents: [
    {
      id: "AUD-1048",
      actor: "Maya Chen",
      action: "Suspended tenant",
      target: "Harbor & Finch",
      time: "Today, 10:42",
      status: "complete",
    },
    {
      id: "AUD-1047",
      actor: "Jordan Lee",
      action: "Updated tenant configuration",
      target: "Northstar Labs",
      time: "Today, 09:18",
      status: "complete",
    },
    {
      id: "AUD-1046",
      actor: "System",
      action: "Requested tenant support review",
      target: "Harbor & Finch",
      time: "Yesterday, 17:25",
      status: "pending",
    },
    {
      id: "AUD-1045",
      actor: "Maya Chen",
      action: "Added tenant administrator",
      target: "Wellspring Co.",
      time: "Yesterday, 14:06",
      status: "complete",
    },
  ],
};
