---
name: docker-github-actions-backend
description: Create and review production-oriented Docker builds and GitHub Actions CI/CD for the NestJS API, background worker, and existing Next.js frontend. Use when designing Dockerfiles, API/worker entrypoints, health checks, migration deployment strategy, CI checks, container scanning, staging/production workflows, or rollback plans. Do not use for deploying systems or changing production infrastructure without explicit authorization.
---

# Docker GitHub Actions Backend

## Workflow

1. Read `AGENTS.md`, package scripts, lockfile, Docker/CI files, deployment docs, and backend/frontend package layout.
2. Inspect the repository's real scripts and package structure before generating Docker or CI files.
3. Design separate API and worker commands from the same backend image where appropriate.
4. Keep migration execution separate from ordinary API replicas.
5. Use least-privilege GitHub Actions permissions and do not print secrets.
6. Include staging validation before protected production deployment.
7. Define rollback or forward-fix steps.
8. Do not deploy anything during ordinary Codex work.

## Docker Rules

- Use multi-stage builds.
- Install with the frozen pnpm lockfile.
- Keep production dependencies minimal.
- Run final containers as a non-root user.
- Do not copy secrets into images.
- Provide health and readiness checks.
- Support graceful shutdown.
- Keep build context small with `.dockerignore`.
- Prefer reproducible builds and OCI metadata where useful.
- Scan images.
- Keep development tools out of the final image unless required.
- Run migrations separately from normal replicas.

## GitHub Actions Rules

- Use least-privilege permissions.
- Use pinned or trusted actions.
- Cache dependencies without hiding lockfile changes.
- Run format, lint, typecheck, unit tests, PostgreSQL integration tests, migration validation, RLS tests, frontend build, backend build, container build, and scanning where applicable.
- Use staging before production.
- Use smoke tests.
- Protect production with environment approval where appropriate.
- Prevent overlapping production deployments.
- Define artifact retention.
- Never print secrets in logs.

## References

- `references/dockerfile-pattern.md`
- `references/api-worker-entrypoints.md`
- `references/health-readiness-shutdown.md`
- `references/github-actions-pipeline.md`
- `references/migration-deployment-strategy.md`
- `references/secrets-and-permissions.md`
- `references/container-security.md`

## Trigger Tests

Should activate:

- "Create a Dockerfile for the NestJS API and worker."
- "Review the GitHub Actions pipeline for RLS integration tests."
- "Design safe migration deployment separate from API replicas."

Should not activate:

- "Deploy this to production now."
- "Fix a React component test."
- "Explain what Docker is."
