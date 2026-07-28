import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const exampleRecords = pgTable(
  "example_records",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdUnique: unique("example_records_tenant_id_id_unique").on(table.tenantId, table.id),
  }),
);
