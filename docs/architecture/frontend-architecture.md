# Frontend architecture

Routes are server components by default. `src/app/(app)/[workspace]` validates the persona route and supplies its user to `WorkspaceShell`; interactive task/list components are isolated client components. `src/mocks` is the sole fixture source. Replace those modules with typed query functions when the API contract is available.
