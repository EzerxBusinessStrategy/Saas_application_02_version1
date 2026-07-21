# Design audit

Inspected frame: `Analytics Dashboard` (`17:577`), 1660×2318 desktop canvas. The Figma MCP screenshot and structured context were retrieved on 2026-07-21.

- Palette: #3C50E0 primary, #1C2434 sidebar, #212B36 main text, #64748B muted text, #E2E8F0 borders, #F8FAFC page background, #10B981 success, #F0950C warning.
- Type: Satoshi; 28px/34px dashboard headings, 22px/28px card headings, 16px/24px sidebar labels, and 14px/22px controls/body labels.
- Surfaces: white card with 2px radius, #E2E8F0 border, and `0 8px 13px -3px rgb(0 0 0 / 0.07)` shadow. Controls use 4px radius and 40px height.
- Layout: 280px sidebar and 80px top bar. Main content is 1290px wide within the desktop content rail.
- Tables: subdued #E2E8F0 dividers, 14px headers, generous rows, and horizontal overflow on narrow screens.
- Charts: grid-led card layouts with 12px bars, #3C50E0 primary series, and semantic status colours. A shadcn Chart registry lookup was unavailable because the environment rejected its certificate chain; no duplicate chart primitive was created.

The supplied frame has no mobile breakpoint annotations. The implemented mobile navigation uses the existing Radix dialog as a left sheet; responsive tables retain horizontal scrolling. Validate these implementation inferences against a future mobile Figma frame.

## NEATLAB hierarchy reference

NEATLAB `Analytics` (`23499:120079`, 1459×1742) was inspected through Figma MCP on 2026-07-21. Its context is image-backed, so it is a hierarchy reference only: summary strip, revenue trend, distribution, health/activity/alert cards, and an audit table. It does not alter the TailAdmin colour, typography, component, or spacing tokens.
