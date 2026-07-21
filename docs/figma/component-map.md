# Component map

Figma file `RuwTxJLr8nLWaqe5CGYkwK`, frame `Analytics Dashboard` (`17:577`) maps to existing components instead of new duplicates.

| Figma pattern                          | Existing implementation                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| 280px dark sidebar (`38:25791`)        | `components/app-shell/workspace-shell.tsx`                   |
| 80px top bar (`563:17290`)             | `components/app-shell/workspace-shell.tsx`                   |
| white 2px-radius shadow card (`18:39`) | `components/ui/card.tsx`                                     |
| 40px date/control pattern (`18:185`)   | `components/ui/button.tsx` and existing native search input  |
| compact status/Pro chip                | `components/ui/badge.tsx` and `shared/status-badge.tsx`      |
| four-metric strip (`18:262`)           | `shared/metric-card.tsx` used by `dashboard/dashboard.tsx`   |
| table pattern (`28:130`)               | `operations/entity-list.tsx` and `operations/tasks-page.tsx` |
| columns and work cards                 | `operations/task-board.tsx`                                  |

Figma icon assets are not copied: the implementation reuses existing Lucide glyphs only when their visual intent is clear, and preserves the local tenant brand asset.

## NEATLAB Super Admin map

| NEATLAB hierarchy                 | Super Admin implementation                               |
| --------------------------------- | -------------------------------------------------------- |
| dashboard context                 | `shared/page-header.tsx`                                 |
| summary metric row                | existing `shared/metric-card.tsx`                        |
| analytics cards                   | `dashboard/chart-card.tsx` composed from existing `Card` |
| audit table                       | `operations/data-table.tsx` using TanStack Table         |
| activity, health, and alert cards | existing `Card`, `StatusBadge`, and `EmptyState`         |
