import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenancy.schema";
import { users } from "./identity.schema";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull().default("INFO"),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actionUrl: text("action_url"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("notifications_idempotency_key_uidx")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    createdIndex: index("notifications_created_idx").on(table.createdAt, table.id),
    tenantCreatedIndex: index("notifications_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
      table.id,
    ),
  }),
);

export const notificationRecipients = pgTable(
  "notification_recipients",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    notificationUserUnique: uniqueIndex("notification_recipients_notification_user_unique").on(
      table.notificationId,
      table.recipientUserId,
    ),
    userUnreadIndex: index("notification_recipients_user_unread_idx").on(
      table.recipientUserId,
      table.createdAt,
      table.notificationId,
    ),
    userCreatedIndex: index("notification_recipients_user_created_idx").on(
      table.recipientUserId,
      table.createdAt,
      table.notificationId,
    ),
  }),
);
