import { sql } from "drizzle-orm";
import { index, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditSchema = pgSchema("audit");

export const auditEvents = auditSchema.table(
  "audit_events",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id"),
    actorUserId: uuid("actor_user_id"),
    actorMembershipId: uuid("actor_membership_id"),
    supportAccessSessionId: uuid("support_access_session_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    result: text("result").notNull(),
    reason: text("reason"),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIndex: index("audit_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
      table.id,
    ),
    actorCreatedIndex: index("audit_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
      table.id,
    ),
  }),
);
