# Service boundary rules

Model the business hierarchy exactly: Platform Operator → Tenant → Client → Service Engagement → Work Group → manager/employee membership → tasks, work logs, approvals, documents. Employees belong to a work group for work assignment, not directly to a client. Each module exposes an approved interface; do not import its repository or internal files.
