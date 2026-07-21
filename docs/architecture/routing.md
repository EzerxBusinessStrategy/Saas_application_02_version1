# Routing

`/super-admin`, `/admin`, `/manager`, `/employee`, and `/client` render persona dashboards. Shared operational routes include `/[workspace]/tasks` and `/[workspace]/{clients,work-groups,documents,invoices,reports,audit-log,branding}`. Unknown workspace or section routes return not-found; backend must still enforce tenant isolation.
