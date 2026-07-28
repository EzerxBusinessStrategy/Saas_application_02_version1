---
name: safe-database-migrations
description: Use when Codex adds or changes PostgreSQL or Drizzle tables, columns, indexes, constraints, enums, data backfills, RLS-policy migrations, PostgreSQL role changes, migration reviews, or schema-drift reviews. Do not use for frontend-only work, general database explanations without a migration, or running production migrations during ordinary Codex work.
---

# Safe Database Migrations

Use this skill to plan or review safe PostgreSQL and Drizzle migrations. Do not create a real migration during skill creation. Do not run against production during ordinary Codex work.

## Workflow

1. Inspect existing schema, migrations, ADRs, architecture docs, package scripts, and deployment model.
2. Classify the migration risk.
3. Preserve rolling-deployment compatibility.
4. Separate schema change, application compatibility, and data backfill when needed.
5. Include RLS, role, tenant-isolation, audit, and rollback implications.
6. Test from an empty database and from the previous schema.
7. State irreversible steps clearly.

## Rules

- Never edit an already-applied migration.
- Never mutate production schemas manually.
- Use expand-and-contract migrations for breaking changes.
- Add required columns safely: nullable/default-compatible column, compatible code, backfill, validation, then `NOT NULL`.
- Add indexes concurrently where supported and appropriate.
- Assess table locking and transaction duration.
- Avoid unsafe type conversions.
- Validate existing rows before adding constraints.
- Use `NOT VALID` and later `VALIDATE CONSTRAINT` where appropriate.
- Preserve backward compatibility during rolling deployment.
- Include RLS implications.
- Include backup, rollback, and forward-fix strategy.
- Test rollback where genuinely supported.
- Never delete data without explicit approval.

## Output Format

For each migration task, report:

1. Existing state
2. Desired state
3. Compatibility analysis
4. Migration steps
5. Application deployment order
6. Backfill plan
7. Validation queries
8. Rollback or forward-fix plan
9. Lock/performance risks
10. Required tests

## References

- `references/migration-risk-levels.md`
- `references/expand-contract-pattern.md`
- `references/column-change-playbook.md`
- `references/index-and-constraint-playbook.md`
- `references/rls-migration-checklist.md`
- `references/release-sequencing.md`

## Assets

- `assets/migration-plan-template.md`
- `assets/migration-review-checklist.md`

## Trigger Tests

Should activate:

- "Add a NOT NULL tenant_id column safely to an existing table."
- "Review this RLS policy migration before deployment."
- "Plan a backfill for invoice line totals using Drizzle migrations."

Should not activate:

- "Change the button color on the login page."
- "Explain what a database index is."
- "Run production migrations now without approval."
