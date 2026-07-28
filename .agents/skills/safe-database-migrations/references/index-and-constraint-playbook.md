# Index and Constraint Playbook

- Add indexes concurrently when supported and appropriate.
- Match indexes to verified query patterns.
- Avoid speculative indexes.
- Validate existing rows before adding constraints.
- Use `NOT VALID` for large foreign keys/checks where useful.
- Run `VALIDATE CONSTRAINT` separately when it reduces lock risk.
- Review write overhead and storage cost for every index.
