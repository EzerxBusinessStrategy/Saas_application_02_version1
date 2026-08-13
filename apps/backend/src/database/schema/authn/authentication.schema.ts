import { sql } from "drizzle-orm";
import { index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const authn = pgSchema("authn");

export const credentials = authn.table("credentials", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  portalType: text("portal_type").notNull(),
  userId: uuid("user_id").notNull(),
  tenantId: uuid("tenant_id"),
  employeeId: uuid("employee_id"),
  clientAccountId: uuid("client_account_id"),
  email: text("email").notNull(),
  emailNormalized: text("email_normalized").notNull(),
  passwordHash: text("password_hash"),
  status: text("status").notNull(),
  failedLoginAttempts: integer("failed_login_attempts").notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => ({
  emailUnique: uniqueIndex("authn_credentials_email_normalized_uidx").on(table.emailNormalized),
  portalEmail: index("authn_credentials_portal_email_idx").on(table.portalType, table.emailNormalized),
}));

export const sessions = authn.table("sessions", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  portalType: text("portal_type").notNull(),
  credentialId: uuid("credential_id").notNull(),
  userId: uuid("user_id").notNull(),
  tenantId: uuid("tenant_id"),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});
