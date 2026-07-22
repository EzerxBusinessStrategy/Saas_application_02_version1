# Professional gamification strategy

Gamification is limited to optional progress visibility: onboarding,
organisation setup, required documents, engagement milestones, team goals, and
work-log consistency. It must reuse TailAdmin cards, badges, progress, dialogs,
and feedback patterns.

Do not add points, public employee leaderboards, punitive streaks, overtime
rewards, or manipulative prompts. Every later progress component needs typed
data, readable text in addition to colour, reduced-motion support, and a clear
permission boundary.

## Phase 2 implementation

- Tenant setup progress identifies incomplete organisation, role, service, and
  notification setup without ranking employees.
- Client onboarding and document completion make client readiness visible.
- Engagement milestone progress and work-group capacity support delivery
  planning; each includes a readable percentage.
- No Phase 2 revenue, collections, debt, working-hours, or disciplinary metric
  is gamified.

## Phase 3 implementation

- Employee progress includes private weekly task and work-log goals, checklist
  progress, upcoming milestones, a protected scheduled-day consistency view,
  and provisional achievements. Approved leave and holidays are protected.
- Manager progress includes aggregate review-queue and weekly delivery goals.
  It does not rank employees or expose personal achievement collections.
- Tenant policy and user preferences can disable gamification and achievement
  notifications. Reduced-motion preferences do not trigger animation.
- Progress is delivery visibility only. It does not reward overtime, use points,
  reset streaks punitively, show public leaderboards, or use sound/celebration
  effects.

## Phase 4 audit

- Calendar delivery milestones now have a readable month view and mobile
  fallback; no progress update relies on animation.
- Existing fixtures cover goal boundaries, tenant-disabled progress,
  reduced-motion preferences, and protected leave/holiday consistency.
- Achievement verification, timezone-aware recurrence, notification delivery,
  and duplicate-prevention remain backend responsibilities and are not claimed
  as durable frontend behaviour.

## Professional progress implementation

- Employee routes provide daily task progress, weekly work-log completion,
  scheduled-day consistency, missing-entry status, private achievements,
  received recognition, and personal visibility preferences.
- Manager recognition is a validated, duplicate-aware mock mutation. It supports
  employee, work-group, and team recipients without public rankings.
- Tenant Admins can set session-local policy switches for progress,
  achievements, recognition, client onboarding, milestones, motion, and timezone.
- Client users see only client-appropriate onboarding steps and authorised
  deliverable feedback/revision information; internal comments and profitability
  are never included in the client fixture.
- Streaks exclude approved leave, holidays, and non-working days. The frontend
  calculation is provisional; timezone, privacy, policy, and idempotency rules
  require backend-authoritative enforcement before production use.
