import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id),
    eventType: text("event_type").notNull().default("TASK_NOTIFICATION_READY"),
    eventKey: text("event_key").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventKeyUnique: uniqueIndex("notification_outbox_event_key_unique").on(table.eventKey),
    pendingIndex: index("notification_outbox_pending_idx")
      .on(table.nextAttemptAt, table.createdAt, table.id)
      .where(sql`${table.status} in ('pending', 'processing')`),
  }),
);
