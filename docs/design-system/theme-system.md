# Global theme system

## Architecture

The application uses the existing `next-themes` provider in
`src/components/providers.tsx`. It applies the selected theme through a class
on the root document, persists the choice under `ezerx-theme`, and defaults to
the operating system preference until a user chooses light or dark mode.

`src/app/globals.css` remains the only token source. The `:root` values are the
TailAdmin-derived light theme and `.dark` supplies the corresponding semantic
dark values. Components must use semantic Tailwind utilities (`bg-card`,
`text-muted-foreground`, `border-border`, and so on), not per-component raw
colours or `dark:` overrides.

## Token groups

| Group                | Examples                                                    | Purpose                                          |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Base surfaces        | `background`, `card`, `surface-elevated`, `surface-subtle`  | Page, card, and elevated visual hierarchy        |
| Content and controls | `foreground`, `muted-foreground`, `input`, `border`, `ring` | Readability, inputs, separators, and focus       |
| Actions and overlays | `primary`, `accent`, `popover`, `destructive`               | Buttons, menus, dialogs, and destructive actions |
| Operational statuses | `success`, `warning`, `danger`, `info`, `chip-*`            | Readable status chips that also include text     |
| Shell                | `sidebar-*`, `header-*`                                     | Role-aware navigation and authenticated header   |

Charts already consume semantic CSS variables such as `--primary`, `--warning`,
and `--border`, so their grid, marks, and labels follow the active theme.

## Theme toggle and transitions

The reusable `ThemeToggle` is placed once in the authenticated app header. It
uses a Lucide sun in light mode and a 24px inline SVG owl in dark mode. The owl
has separate head, face, eye, pupil, eyelid, beak, and feather layers; its
eyelids make one subtle two-second blink and pause when the document is hidden.
The control is an accessible button with a descriptive label, pressed state,
focus ring, keyboard support, and a loading-safe initial render that avoids a
hydration mismatch.

The first theme switch in any 45-second window can show one short,
non-interactive transition overlay:

- Light to dark: five independently configured blue-white shooting stars. Each
  has its own viewport path, delay, duration, scale, trail length, and glow.
  The fixed overlay lasts 2.8 seconds, so the final delayed star can complete.
- Dark to light: a short golden illumination from the toggle position.

The timestamp is saved as `ezerx-theme-transition-at` in localStorage. Theme
changes themselves always happen immediately; only the special overlay is
suppressed during the cooldown. The overlay is `aria-hidden`, fixed,
pointer-event-free, and unmounts after its matching animation completes.

For local visual development only, clear the cooldown from the browser console:

```js
localStorage.removeItem("ezerx-theme-transition-at");
```

## Accessibility and reduced motion

`prefers-reduced-motion` prevents the special overlays and owl blink while
preserving the functional theme control. The provider sets the browser colour
scheme, Sonner notifications follow the resolved light/dark state, and
contrast-sensitive primitives use semantic tokens in both modes. Status chips
always retain their textual labels, so colour is not the only status signal.

## Validation notes

Theme component tests cover persistence, normal switching, cooldown behaviour,
reduced-motion suppression, owl rendering, and overlay cleanup. Repository
lint, TypeScript, unit, build, and installed-Edge responsive checks are
recorded in `docs/testing/frontend-validation.md` after each validation run.
