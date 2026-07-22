# Global theme system implementation plan

## Scope

Add persisted light, dark, and system-aware theming to the existing
TailAdmin-derived application without replacing its route architecture,
components, navigation, or permissions.

## Implementation steps

1. Extend the current semantic token layer in `src/app/globals.css` with
   light and dark values for surfaces, controls, status chips, sidebar, header,
   charts, borders, and focus states. Keep TailAdmin spacing, typography,
   radii, and visual hierarchy intact.
2. Keep `next-themes` as the sole provider, configure a stable storage key and
   system fallback, and make Sonner notifications follow the resolved theme.
3. Add one reusable `ThemeToggle` composition to the authenticated shell. It
   will use a Lucide sun in light mode, an inline SVG owl in dark mode, and
   mount only a short-lived non-interactive transition overlay when allowed.
4. Implement the five-minute localStorage cooldown and reduced-motion fallback
   for the special shooting-star and golden-ray effects. Normal theme changes
   remain immediate and keyboard accessible.
5. Correct theme-sensitive shared primitives and app-shell hard-coded colours,
   then verify cards, tables, inputs, status badges, header, sidebar, dialogs,
   menus, charts, and Super Admin surfaces use semantic tokens.
6. Add focused component tests for rendering, keyboard use, persistence,
   cooldown, reduced motion, overlay cleanup, and dark-mode class behavior.
7. Document architecture, tokens, motion limits, cooldown behavior, and the
   current validation results. Run available formatting, lint, type, test,
   build, and Edge responsive verification.

## Guardrails

- No new dependency or generic primitive system.
- Transition visuals are a short-lived, user-requested exception to the
  no-decorative-gradient rule; they use CSS transforms and opacity only where
  practical and never block input.
- Do not weaken SSL or download a browser.
- Preserve unrelated work in the dirty tree.
