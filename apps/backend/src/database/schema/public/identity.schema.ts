import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenancy.schema";
import { roles } from "./authorization.schema";

export const users = pgTable(
  "users",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    supabaseAuthUserId: uuid("supabase_auth_user_id"),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    status: text("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    avatarPath: text("avatar_path"),
    avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authUserUnique: uniqueIndex("users_supabase_auth_user_id_uidx").on(table.supabaseAuthUserId),
    emailUnique: uniqueIndex("users_email_normalized_uidx").on(table.emailNormalized),
    statusIndex: index("users_status_idx").on(table.status, table.id),
  }),
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("active"),
    displayName: text("display_name").notNull(),
    displayTitle: text("display_title"),
    timezone: text("timezone").notNull().default("UTC"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByMembershipId: uuid("revoked_by_membership_id"),
    revocationReason: text("revocation_reason"),
    reactivatedAt: timestamp("reactivated_at", { withTimezone: true }),
    reactivatedByMembershipId: uuid("reactivated_by_membership_id"),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("tenant_memberships_tenant_id_id_uidx").on(
      table.tenantId,
      table.id,
    ),
    tenantUserUnique: uniqueIndex("tenant_memberships_tenant_user_uidx").on(
      table.tenantId,
      table.userId,
    ),
    tenantStatusIndex: index("tenant_memberships_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.id,
    ),
  }),
);

export const platformUserRoles = pgTable(
  "platform_user_roles",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    roleScope: text("role_scope").notNull().default("platform"),
    status: text("status").notNull().default("active"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    userRoleUnique: uniqueIndex("platform_user_roles_user_role_uidx").on(
      table.userId,
      table.roleId,
    ),
    userStatusIndex: index("platform_user_roles_user_status_idx").on(
      table.userId,
      table.status,
      table.roleId,
    ),
  }),
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    inviteeDisplayName: text("invitee_display_name"),
    intendedRoleId: uuid("intended_role_id")
      .notNull()
      .references(() => roles.id),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    invitedByMembershipId: uuid("invited_by_membership_id"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id),
    revokedByMembershipId: uuid("revoked_by_membership_id"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id),
    cancelledByMembershipId: uuid("cancelled_by_membership_id"),
    supabaseAuthUserId: uuid("supabase_auth_user_id"),
    supabaseInvitationId: text("supabase_invitation_id"),
    deliveryStatus: text("delivery_status").notNull().default("not_sent"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("invitations_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantPendingEmailUnique: uniqueIndex("invitations_tenant_pending_email_uidx")
      .on(table.tenantId, table.emailNormalized)
      .where(sql`${table.status} = 'pending'`),
    tenantStatusIndex: index("invitations_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.expiresAt,
      table.id,
    ),
    emailIndex: index("invitations_email_idx").on(table.emailNormalized, table.tenantId),
  }),
);

export const authSessionPolicies = pgTable(
  "auth_session_policies",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    supabaseSessionId: text("supabase_session_id").notNull(),
    rememberMe: boolean("remember_me").notNull().default(false),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    authContextVersion: integer("auth_context_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionUnique: uniqueIndex("auth_session_policies_session_unique").on(table.supabaseSessionId),
    userActiveIndex: index("auth_session_policies_user_active_idx").on(
      table.userId,
      table.absoluteExpiresAt,
      table.supabaseSessionId,
    ),
  }),
);
