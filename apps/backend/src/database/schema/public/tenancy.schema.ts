import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    code: text("code").notNull(),
    slug: text("slug"),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("provisioning"),
    country: text("country"),
    currency: text("currency"),
    timezone: text("timezone").notNull().default("UTC"),
    industry: text("industry"),
    registrationNumber: text("registration_number"),
    taxIdentifier: text("tax_identifier"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionEndsAt: timestamp("suspension_ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("tenants_code_uidx").on(table.code),
    slugUnique: uniqueIndex("tenants_slug_uidx").on(table.slug),
    statusIndex: index("tenants_status_idx").on(table.status, table.id),
  }),
);
