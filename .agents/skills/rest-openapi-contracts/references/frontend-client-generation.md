# Frontend Client Generation

- Prefer generated frontend clients from OpenAPI over hand-duplicated contracts.
- Preserve existing Next.js and TanStack Query call sites where possible.
- Map generated responses into UI view models only at feature boundaries.
- Document frontend migration impact when provisional mock contracts change.
- Keep mock and real implementations replaceable until backend contracts are final.
