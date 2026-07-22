# Tokens

TailAdmin `Analytics Dashboard` (Figma `17:577`) is the baseline for shared application UI. Tokens live in `src/app/globals.css`; feature components use their semantic names instead of repeating raw values.

| Token                 | Value                 | Use                                       |
| --------------------- | --------------------- | ----------------------------------------- |
| `primary`             | `#3C50E0`             | primary actions, focus, selected emphasis |
| `foreground`          | `#212B36`             | headings and main text                    |
| `muted-foreground`    | `#64748B`             | supporting text and table labels          |
| `background`          | `#F8FAFC`             | page surface                              |
| `card`                | `#FFFFFF`             | cards and top bar                         |
| `border`              | `#E2E8F0`             | cards, inputs, table dividers             |
| `sidebar`             | `#1C2434`             | desktop and mobile workspace navigation   |
| `sidebar-active`      | `#333A48`             | selected navigation item                  |
| `success` / `warning` | `#10B981` / `#F0950C` | status emphasis                           |

Cards use `--radius-card: 2px` and `--shadow-card: 0 8px 13px -3px rgb(0 0 0 / 0.07)`. Controls use `--radius-control: 4px`; the desktop sidebar uses `--sidebar-expanded-width: 256px` and `--sidebar-collapsed-width: 76px`, while the header uses `--header-height: 80px`.

Light and dark values for these tokens are defined in `src/app/globals.css`.
See [theme-system.md](theme-system.md) for the semantic theme architecture and
motion safeguards.

`Satoshi` is the reference font from Figma. The application uses it when available and falls back to Helvetica Neue/Arial until a licensed webfont asset is supplied.
