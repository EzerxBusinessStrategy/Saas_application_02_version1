# Dockerfile Pattern

- Use builder and runtime stages.
- Install with `pnpm install --frozen-lockfile`.
- Copy only required build outputs and production dependencies into runtime.
- Run as non-root.
- Do not include `.env` or secrets.
- Add OCI labels only with non-sensitive metadata.
