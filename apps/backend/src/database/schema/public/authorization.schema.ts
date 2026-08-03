import { sql } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    scope: text("scope").notNull(),
    systemRole: boolean("system_role").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("roles_code_uidx").on(table.code),
    scopeIndex: index("roles_scope_idx").on(table.scope, table.id),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("permissions_code_uidx").on(table.code),
    resourceActionIndex: index("permissions_resource_action_idx").on(
      table.resource,
      table.action,
      table.id,
    ),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    permissionIndex: index("role_permissions_permission_idx").on(table.permissionId, table.roleId),
  }),
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    membershipId: uuid("membership_id").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    assignedByMembershipId: uuid("assigned_by_membership_id"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").notNull().default("active"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByMembershipId: uuid("revoked_by_membership_id"),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("membership_roles_tenant_id_id_uidx").on(table.tenantId, table.id),
    membershipRoleUnique: uniqueIndex("membership_roles_tenant_membership_role_uidx").on(
      table.tenantId,
      table.membershipId,
      table.roleId,
    ),
    tenantMembershipIndex: index("membership_roles_tenant_membership_idx").on(
      table.tenantId,
      table.membershipId,
    ),
    tenantMembershipStatusIndex: index("membership_roles_tenant_membership_status_idx").on(
      table.tenantId,
      table.membershipId,
      table.status,
    ),
  }),
);
