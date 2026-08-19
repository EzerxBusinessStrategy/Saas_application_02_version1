export function tenantTaskOverviewHrefs(period: { readonly from: string; readonly to: string }) {
  const range = `from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}&range=kpi`;
  return {
    open: `/admin/allocated-work?status=open&${range}`,
    completed: `/admin/allocated-work?status=completed&${range}`,
    overdue: `/admin/allocated-work?status=overdue`,
  } as const;
}
