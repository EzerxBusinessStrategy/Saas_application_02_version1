# Resource Scope Policy Pattern

A policy should answer:

1. Who is the trusted actor?
2. What action is requested?
3. What resource is targeted?
4. Which tenant owns the resource?
5. Which scope relationship grants access?
6. Should denial hide resource existence?
7. Should the decision be audited?

Examples:

- Manager task access requires assigned work-group membership.
- Employee task access requires assignee/self relationship.
- Client document access requires own client account plus document grant or client-visible state.
