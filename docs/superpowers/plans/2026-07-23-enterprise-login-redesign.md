# Enterprise Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/login` as a responsive SaaS App enterprise authentication experience while preserving the approved demo login flow.

**Architecture:** Keep `AuthForm` as the only authentication form owner. Add a login-only split layout, retain its existing React Hook Form/Zod/API behaviour, and use small local presentational subcomponents plus global CSS only for the restrained branded background and entrance motion.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing shadcn-style Card/Input/Button/Select components, Lucide.

## Tasks

- [x] Rework the login mode layout in `src/components/auth/auth-form.tsx`; preserve recovery, reset, invitation, validation, endpoint, role, and redirect logic.
- [x] Move forgot-password navigation into the form and remove the viewport-fixed link from `src/app/(auth)/login/page.tsx`.
- [x] Add CSS-only branded-panel decoration and reduced-motion support in `src/app/globals.css`.
- [x] Extend `src/components/auth/auth-form.test.tsx` for login hierarchy, role selection, visible password control, and recovery navigation.
- [x] Verify desktop, tablet, and mobile in Edge; run lint, typecheck, test, and production build.
