# Tenant Branding Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Tenant Settings → Branding with interactive, isolated previews for colour, theme, dashboard density, font, and a local custom-design image.

**Architecture:** Keep all state in the existing `BrandingSettings` client component and reuse native colour/file inputs, React Hook Form, Tailwind tokens, and the existing Card/Input/Select/Button primitives. The custom image remains an in-memory preview only; it is not uploaded or published because secure tenant storage and a controlled theme-token API are not available.

**Tech Stack:** Next.js, React, TypeScript, React Hook Form, Zod, Tailwind CSS, Lucide React, Vitest/Testing Library.

## Global Constraints

- Reuse the current TailAdmin-based settings form and isolated live preview.
- Do not add dependencies, backend endpoints, or persisted file uploads.
- Use native colour and file inputs for accessibility and browser support.
- Keep company name and login heading out of this branding form; expose one optional portal subtitle instead.
- Treat the uploaded custom design as a local visual reference, never executable CSS or an active platform theme.

---

### Task 1: Expand the typed branding draft and its validation test

**Files:**
- Modify: `src/types/administration.ts`
- Modify: `src/components/tenant-administration/workforce-administration.test.tsx`

- [x] Replace required `displayName` and `loginHeading` with optional `portalSubtitle`.
- [x] Add `custom` to the preview-only theme selection and add `relaxed` and `spacious` density values.
- [x] Extend the existing branding test to assert the optional subtitle and custom-design upload control are rendered.

### Task 2: Implement the compact controls and isolated preview

**Files:**
- Modify: `src/components/tenant-administration/workforce-administration.tsx`

- [x] Add a feature-level reusable colour field that combines validated hex text input, native colour picker, and RGB readout.
- [x] Replace the required company/login fields with an optional portal subtitle.
- [x] Add standard theme, two extra density choices, and browser-safe font choices to the existing select controls.
- [x] Add a small image-only local file input; create and revoke its object URL in the component lifecycle.
- [x] Use the current right-side preview to immediately reflect theme contrast, colours, density, font, subtitle, and custom-design image.
- [x] Keep publish status explicit that the preview is not a portal-wide publish and an uploaded image is not stored.

### Task 3: Validate

**Files:**
- No source changes expected.

- [x] Run `corepack pnpm typecheck` and `corepack pnpm lint`.
- [x] Run `corepack pnpm test` and `corepack pnpm build`.
- [x] Verify the local `/admin/settings` route returns HTTP 200 after hot reload.

### Task 4: Apply a browser-session branding draft

**Files:**
- Create: `src/lib/tenant-branding-session.ts`
- Modify: `src/components/providers.tsx`
- Modify: `src/components/app-shell/workspace-shell.tsx`
- Modify: `src/components/tenant-administration/workforce-administration.tsx`
- Modify: `src/components/tenant-administration/workforce-administration.test.tsx`

- [x] Store only validated colour, density, font, and standard-theme values in `sessionStorage`; never store uploaded image bytes or object URLs.
- [x] Apply the session values as semantic CSS variable overrides and a root density attribute; restore them through the existing global Providers component.
- [x] Make Publish changes apply the draft immediately and announce that it applies only to the current browser session.
- [x] Use the density variable in the shared app-shell main-content padding so every portal visibly reflects it.
- [x] Test Publish changes sets the session draft and semantic primary token.
