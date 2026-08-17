import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantMemberships, users } from "./identity.schema";
import { tenants } from "./tenancy.schema";

export const financialYearTemplates = pgTable(
  "financial_year_templates",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    countryCode: text("country_code").notNull(),
    name: text("name").notNull(),
    policyMode: text("policy_mode").default("COUNTRY_FIXED").notNull(),
    startMonth: integer("start_month").notNull(),
    startDay: integer("start_day").notNull(),
    endMonth: integer("end_month").notNull(),
    endDay: integer("end_day").notNull(),
    confirmationRequired: boolean("confirmation_required").default(true).notNull(),
    customAllowed: boolean("custom_allowed").default(true).notNull(),
    maximumPeriodDays: integer("maximum_period_days"),
    supports5253Week: boolean("supports_52_53_week").default(false).notNull(),
    effectiveFrom: date("effective_from").default("2026-01-01").notNull(),
    effectiveTo: date("effective_to"),
    policyVersion: text("policy_version").default("2026.1").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    countryActiveIndex: index("financial_year_templates_country_active_idx").on(
      table.countryCode,
      table.isActive,
      table.id,
    ),
  }),
);

export const tenantFinancialYears = pgTable(
  "tenant_financial_years",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    templateId: uuid("template_id").references(() => financialYearTemplates.id),
    countryCode: text("country_code").notNull(),
    label: text("label").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text("status").default("planned").notNull(),
    source: text("source").default("COUNTRY_SUGGESTION_CONFIRMED").notNull(),
    isCurrent: boolean("is_current").default(false).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id),
    overrideReason: text("override_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("tenant_financial_years_tenant_id_id_uidx").on(
      table.tenantId,
      table.id,
    ),
    tenantIdCountryIdUnique: uniqueIndex("tenant_financial_years_tenant_id_id_country_code_uidx").on(
      table.tenantId,
      table.id,
      table.countryCode,
    ),
    tenantDateIndex: index("tenant_financial_years_tenant_dates_idx").on(
      table.tenantId,
      table.countryCode,
      table.startDate,
      table.endDate,
    ),
  }),
);

export const tenantHealthBands = pgTable(
  "tenant_health_bands",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    minimumTurnover: numeric("minimum_turnover", { precision: 18, scale: 2 }).notNull(),
    maximumTurnover: numeric("maximum_turnover", { precision: 18, scale: 2 }),
    sortOrder: integer("sort_order").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("tenant_health_bands_code_uidx").on(table.code),
    activeSortIndex: index("tenant_health_bands_active_sort_idx").on(
      table.isActive,
      table.sortOrder,
      table.id,
    ),
  }),
);

export const tenantReviews = pgTable(
  "tenant_reviews",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    reviewType: text("review_type").notNull(),
    status: text("status").default("pending").notNull(),
    dueDate: date("due_date"),
    reason: text("reason"),
    priority: text("priority").default("normal").notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    internalNotes: text("internal_notes"),
    resolution: text("resolution"),
    lastActionByUserId: uuid("last_action_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("tenant_reviews_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantStatusDueIndex: index("tenant_reviews_tenant_status_due_idx").on(
      table.tenantId,
      table.status,
      table.dueDate,
      table.id,
    ),
  }),
);

export const platformAlerts = pgTable(
  "platform_alerts",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actionUrl: text("action_url"),
    status: text("status").default("open").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    viewedByUserId: uuid("viewed_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("platform_alerts_idempotency_unique").on(table.idempotencyKey),
    statusCreatedIndex: index("platform_alerts_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    tenantStatusIndex: index("platform_alerts_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
      table.id,
    ),
  }),
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("departments_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("departments_tenant_code_uidx").on(table.tenantId, table.code),
    tenantStatusIndex: index("departments_tenant_status_idx").on(table.tenantId, table.status, table.id),
  }),
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").default("active").notNull(),
    deliveryHealth: text("delivery_health"),
    onboardingStatus: text("onboarding_status").default("pending").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("clients_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("clients_tenant_code_uidx").on(table.tenantId, table.code),
    tenantStatusNameIndex: index("clients_tenant_status_name_idx").on(
      table.tenantId,
      table.status,
      table.displayName,
      table.id,
    ),
  }),
);

export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    name: text("name").notNull(),
    roleTitle: text("role_title"),
    email: text("email"),
    phone: text("phone"),
    preference: text("preference"),
    status: text("status").default("active").notNull(),
    primaryContact: boolean("primary_contact").default(false).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("client_contacts_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantClientIndex: index("client_contacts_tenant_client_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.id,
    ),
  }),
);

export const clientPortalAccounts = pgTable(
  "client_portal_accounts",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => tenantMemberships.id),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    phone: text("phone"),
    portalName: text("portal_name"),
    primaryColour: text("primary_colour"),
    sidebarColour: text("sidebar_colour"),
    surfaceColour: text("surface_colour"),
    status: text("status").default("active").notNull(),
    createdByMembershipId: uuid("created_by_membership_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantClientActiveUnique: uniqueIndex("client_portal_accounts_tenant_client_active_uidx")
      .on(table.tenantId, table.clientId)
      .where(sql`${table.status} = 'active'`),
    tenantUserActiveUnique: uniqueIndex("client_portal_accounts_tenant_user_active_uidx")
      .on(table.tenantId, table.userId)
      .where(sql`${table.status} = 'active'`),
    emailUnique: uniqueIndex("client_portal_accounts_email_normalized_uidx").on(table.emailNormalized),
    membershipIndex: index("client_portal_accounts_membership_idx").on(table.tenantId, table.membershipId),
  }),
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    taskType: text("task_type"),
    defaultBillingModel: text("default_billing_model").default("per_task").notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("services_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("services_tenant_code_uidx").on(table.tenantId, table.code),
    tenantStatusIndex: index("services_tenant_status_idx").on(table.tenantId, table.status, table.id),
  }),
);

export const engagements = pgTable(
  "engagements",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").default("active").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("engagements_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("engagements_tenant_code_uidx").on(table.tenantId, table.code),
    tenantClientStatusIndex: index("engagements_tenant_client_status_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.id,
    ),
  }),
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    membershipId: uuid("membership_id").notNull(),
    employeeCode: text("employee_code").notNull(),
    departmentId: uuid("department_id"),
    experienceLevel: text("experience_level"),
    employmentStatus: text("employment_status").default("active").notNull(),
    defaultCapacityMinutesPerWeek: integer("default_capacity_minutes_per_week"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("employees_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("employees_tenant_code_uidx").on(table.tenantId, table.employeeCode),
    tenantMembershipUnique: uniqueIndex("employees_tenant_membership_uidx").on(
      table.tenantId,
      table.membershipId,
    ),
    tenantDepartmentStatusIndex: index("employees_tenant_department_status_idx").on(
      table.tenantId,
      table.departmentId,
      table.employmentStatus,
      table.id,
    ),
  }),
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("skills_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("skills_tenant_code_uidx").on(table.tenantId, table.code),
    tenantStatusIndex: index("skills_tenant_status_idx").on(table.tenantId, table.status, table.id),
  }),
);

export const employeeSkills = pgTable(
  "employee_skills",
  {
    tenantId: uuid("tenant_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    skillId: uuid("skill_id").notNull(),
    proficiencyLevel: text("proficiency_level").notNull(),
    yearsOfExperience: numeric("years_of_experience", { precision: 5, scale: 2 }),
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedBy: uuid("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.employeeId, table.skillId] }),
    tenantSkillIndex: index("employee_skills_tenant_skill_idx").on(table.tenantId, table.skillId),
  }),
);

export const workGroups = pgTable(
  "work_groups",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id"),
    engagementId: uuid("engagement_id"),
    code: text("code"),
    name: text("name").notNull(),
    groupType: text("group_type").default("delivery").notNull(),
    status: text("status").default("active").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("work_groups_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCodeUnique: uniqueIndex("work_groups_tenant_code_uidx").on(table.tenantId, table.code),
    tenantStatusIndex: index("work_groups_tenant_status_idx").on(table.tenantId, table.status, table.id),
  }),
);

export const workGroupMemberships = pgTable(
  "work_group_memberships",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    workGroupId: uuid("work_group_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    groupRole: text("group_role").notNull(),
    status: text("status").default("active").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    addedBy: uuid("added_by"),
    removedBy: uuid("removed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("work_group_memberships_tenant_id_id_uidx").on(table.tenantId, table.id),
    activeEmployeeUnique: uniqueIndex("work_group_memberships_active_employee_uidx")
      .on(table.tenantId, table.workGroupId, table.employeeId)
      .where(sql`${table.status} = 'active'`),
    tenantEmployeeIndex: index("work_group_memberships_tenant_employee_idx").on(
      table.tenantId,
      table.employeeId,
      table.workGroupId,
    ),
  }),
);

export const clientTaskRequests = pgTable(
  "client_task_requests",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    clientContactId: uuid("client_contact_id"),
    serviceId: uuid("service_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    countryCode: text("country_code").notNull(),
    requestedDueDate: date("requested_due_date"),
    priority: text("priority").default("normal").notNull(),
    status: text("status").default("submitted").notNull(),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    convertedTaskId: uuid("converted_task_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("client_task_requests_tenant_id_id_uidx").on(table.tenantId, table.id),
    convertedTaskUnique: uniqueIndex("client_task_requests_converted_task_uidx")
      .on(table.tenantId, table.convertedTaskId)
      .where(sql`${table.convertedTaskId} is not null`),
    tenantClientStatusIndex: index("client_task_requests_tenant_client_status_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.submittedAt,
      table.id,
    ),
  }),
);

export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id"),
    serviceId: uuid("service_id"),
    countryCode: text("country_code"),
    priority: text("priority"),
    name: text("name").notNull(),
    targetMinutes: integer("target_minutes").notNull(),
    warningMinutes: integer("warning_minutes"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("sla_policies_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantLookupIndex: index("sla_policies_tenant_lookup_idx").on(
      table.tenantId,
      table.clientId,
      table.serviceId,
      table.countryCode,
      table.priority,
      table.status,
    ),
  }),
);

export const complianceCalendarRules = pgTable(
  "compliance_calendar_rules",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    countryCode: text("country_code").notNull(),
    serviceId: uuid("service_id"),
    taskType: text("task_type").notNull(),
    name: text("name").notNull(),
    frequency: text("frequency").notNull(),
    dueRule: jsonb("due_rule").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("compliance_calendar_rules_tenant_id_id_uidx").on(
      table.tenantId,
      table.id,
    ),
    tenantLookupIndex: index("compliance_calendar_rules_tenant_lookup_idx").on(
      table.tenantId,
      table.countryCode,
      table.serviceId,
      table.taskType,
      table.status,
    ),
  }),
);

export const rateCards = pgTable(
  "rate_cards",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id"),
    name: text("name").notNull(),
    countryCode: text("country_code"),
    currencyCode: text("currency_code").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    status: text("status").default("active").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("rate_cards_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantLookupIndex: index("rate_cards_tenant_lookup_idx").on(
      table.tenantId,
      table.clientId,
      table.countryCode,
      table.status,
      table.effectiveFrom,
    ),
  }),
);

export const rateCardItems = pgTable(
  "rate_card_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    rateCardId: uuid("rate_card_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    taskType: text("task_type").notNull(),
    unitType: text("unit_type").notNull(),
    rateAmount: numeric("rate_amount", { precision: 18, scale: 2 }).notNull(),
    taxCode: text("tax_code"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("rate_card_items_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantCardServiceIndex: index("rate_card_items_tenant_card_service_idx").on(
      table.tenantId,
      table.rateCardId,
      table.serviceId,
      table.taskType,
      table.status,
    ),
  }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientTaskRequestId: uuid("client_task_request_id"),
    clientId: uuid("client_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    engagementId: uuid("engagement_id"),
    workGroupId: uuid("work_group_id"),
    countryCode: text("country_code").notNull(),
    financialYearId: uuid("financial_year_id").notNull(),
    complianceCalendarRuleId: uuid("compliance_calendar_rule_id"),
    slaPolicyId: uuid("sla_policy_id"),
    rateCardItemId: uuid("rate_card_item_id"),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").default("normal").notNull(),
    status: text("status").default("draft").notNull(),
    plannedStartAt: timestamp("planned_start_at", { withTimezone: true }),
    plannedDueAt: timestamp("planned_due_at", { withTimezone: true }),
    actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
    actualCompletedAt: timestamp("actual_completed_at", { withTimezone: true }),
    slaTargetMinutes: integer("sla_target_minutes"),
    slaElapsedMinutes: integer("sla_elapsed_minutes"),
    slaStatus: text("sla_status").default("not_started"),
    billableStatus: text("billable_status").default("not_billable").notNull(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("tasks_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantWorkGroupStatusIndex: index("tasks_tenant_work_group_status_idx").on(
      table.tenantId,
      table.workGroupId,
      table.status,
      table.id,
    ),
    tenantClientStatusIndex: index("tasks_tenant_client_status_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.plannedDueAt,
      table.id,
    ),
    tenantFinancialYearIndex: index("tasks_tenant_financial_year_idx").on(
      table.tenantId,
      table.financialYearId,
      table.status,
      table.id,
    ),
  }),
);

export const taskSkillRequirements = pgTable(
  "task_skill_requirements",
  {
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").notNull(),
    skillId: uuid("skill_id").notNull(),
    minimumProficiency: text("minimum_proficiency").notNull(),
    isMandatory: boolean("is_mandatory").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.skillId] }),
    tenantSkillIndex: index("task_skill_requirements_tenant_skill_idx").on(table.tenantId, table.skillId),
  }),
);

export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    assignedBy: uuid("assigned_by"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").default("active").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by"),
    assignmentSource: text("assignment_source").default("direct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("task_assignments_tenant_id_id_uidx").on(table.tenantId, table.id),
    taskEmployeeUnique: uniqueIndex("task_assignments_tenant_task_employee_uidx").on(
      table.tenantId,
      table.taskId,
      table.employeeId,
    ),
    tenantEmployeeStatusIndex: index("task_assignments_tenant_employee_status_idx").on(
      table.tenantId,
      table.employeeId,
      table.status,
      table.taskId,
    ),
  }),
);

export const taskSubmissions = pgTable(
  "task_submissions",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    submittedBy: uuid("submitted_by"),
    status: text("status").default("submitted").notNull(),
    remarks: text("remarks"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("task_submissions_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantTaskStatusIndex: index("task_submissions_tenant_task_status_idx").on(
      table.tenantId,
      table.taskId,
      table.status,
      table.submittedAt,
    ),
  }),
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").notNull(),
    submissionId: uuid("submission_id"),
    approvalStage: text("approval_stage").notNull(),
    decision: text("decision").notNull(),
    remarks: text("remarks"),
    decidedBy: uuid("decided_by").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("approvals_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantTaskStageIndex: index("approvals_tenant_task_stage_idx").on(
      table.tenantId,
      table.taskId,
      table.approvalStage,
      table.decidedAt,
    ),
  }),
);

export const billableTaskEntries = pgTable(
  "billable_task_entries",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").notNull(),
    clientId: uuid("client_id").notNull(),
    rateCardItemId: uuid("rate_card_item_id"),
    currencyCode: text("currency_code").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    unitRate: numeric("unit_rate", { precision: 18, scale: 2 }).notNull(),
    grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
    discountType: text("discount_type"),
    discountValue: numeric("discount_value", { precision: 18, scale: 2 }),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
    status: text("status").default("pending_review").notNull(),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    invoiceItemId: uuid("invoice_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("billable_task_entries_tenant_id_id_uidx").on(table.tenantId, table.id),
    activeTaskUnique: uniqueIndex("billable_task_entries_active_task_uidx")
      .on(table.tenantId, table.taskId)
      .where(sql`${table.status} <> 'cancelled'`),
    tenantClientStatusIndex: index("billable_task_entries_tenant_client_status_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.id,
    ),
  }),
);

export const taskEmployeeContributions = pgTable(
  "task_employee_contributions",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    contributionPercentage: numeric("contribution_percentage", { precision: 5, scale: 2 }).notNull(),
    revenueShareAmount: numeric("revenue_share_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    recordedBy: uuid("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("task_employee_contributions_tenant_id_id_uidx").on(
      table.tenantId,
      table.id,
    ),
    taskEmployeeUnique: uniqueIndex("task_employee_contributions_task_employee_uidx").on(
      table.tenantId,
      table.taskId,
      table.employeeId,
    ),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    financialYearId: uuid("financial_year_id"),
    invoiceNumber: text("invoice_number").notNull(),
    issuedOn: date("issued_on").notNull(),
    dueOn: date("due_on"),
    subtotalAmount: numeric("subtotal_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    currencyCode: text("currency_code").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    status: text("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("invoices_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantInvoiceNumberUnique: uniqueIndex("invoices_tenant_invoice_number_uidx").on(
      table.tenantId,
      table.invoiceNumber,
    ),
    tenantClientStatusDueIndex: index("invoices_tenant_client_status_due_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.dueOn,
      table.id,
    ),
  }),
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    taskId: uuid("task_id"),
    billableTaskEntryId: uuid("billable_task_entry_id"),
    serviceId: uuid("service_id"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    unitRate: numeric("unit_rate", { precision: 18, scale: 2 }).notNull(),
    grossAmount: numeric("gross_amount", { precision: 18, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    netAmount: numeric("net_amount", { precision: 18, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("invoice_items_tenant_id_id_uidx").on(table.tenantId, table.id),
    billableUnique: uniqueIndex("invoice_items_billable_task_entry_uidx")
      .on(table.tenantId, table.billableTaskEntryId)
      .where(sql`${table.billableTaskEntryId} is not null`),
    tenantInvoiceIndex: index("invoice_items_tenant_invoice_idx").on(table.tenantId, table.invoiceId, table.id),
  }),
);

export const employeeServiceCapabilities = pgTable(
  "employee_service_capabilities",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("employee_service_capabilities_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantEmployeeServiceUnique: uniqueIndex("employee_service_capabilities_unique").on(
      table.tenantId,
      table.employeeId,
      table.serviceId,
    ),
    tenantEmployeeIndex: index("employee_service_capabilities_tenant_employee_idx").on(
      table.tenantId,
      table.employeeId,
      table.status,
    ),
    tenantServiceIndex: index("employee_service_capabilities_tenant_service_idx").on(
      table.tenantId,
      table.serviceId,
      table.status,
    ),
  }),
);

export const engagementServiceConfigurations = pgTable(
  "engagement_service_configurations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    engagementId: uuid("engagement_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    assignedEmployeeId: uuid("assigned_employee_id").notNull(),
    countryCode: text("country_code").notNull(),
    configurationSnapshot: jsonb("configuration_snapshot").notNull(),
    estimatedTotal: numeric("estimated_total", { precision: 18, scale: 2 }).default("0").notNull(),
    currencyCode: text("currency_code").notNull(),
    status: text("status").default("active").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("engagement_service_configurations_tenant_id_id_uidx").on(
      table.tenantId,
      table.id,
    ),
    engagementUnique: uniqueIndex("engagement_service_configurations_engagement_unique").on(
      table.tenantId,
      table.engagementId,
    ),
    idempotencyUnique: uniqueIndex("engagement_service_configurations_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
      table.serviceId,
    ),
    tenantServiceIndex: index("engagement_service_configurations_tenant_service_idx").on(
      table.tenantId,
      table.serviceId,
      table.status,
      table.id,
    ),
  }),
);

export const clientServiceRequests = pgTable(
  "client_service_requests",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    countryCode: text("country_code").notNull(),
    currencyCode: text("currency_code").notNull(),
    status: text("status").default("submitted").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    estimatedTotal: numeric("estimated_total", { precision: 18, scale: 2 }).default("0").notNull(),
    submittedByUserId: uuid("submitted_by_user_id"),
    reviewedByUserId: uuid("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewRemarks: text("review_remarks"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("client_service_requests_tenant_id_id_uidx").on(table.tenantId, table.id),
    idempotencyUnique: uniqueIndex("client_service_requests_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    tenantClientStatusIndex: index("client_service_requests_tenant_client_status_idx").on(
      table.tenantId,
      table.clientId,
      table.status,
      table.submittedAt,
      table.id,
    ),
    tenantStatusIndex: index("client_service_requests_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.submittedAt,
      table.id,
    ),
  }),
);

export const clientServiceRequestItems = pgTable(
  "client_service_request_items",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    requestId: uuid("request_id").notNull(),
    clientId: uuid("client_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    taskSnapshot: jsonb("task_snapshot").notNull(),
    assignedEmployeeId: uuid("assigned_employee_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("client_service_request_items_tenant_id_id_uidx").on(table.tenantId, table.id),
    requestServiceUnique: uniqueIndex("client_service_request_items_request_service_unique").on(
      table.tenantId,
      table.requestId,
      table.serviceId,
    ),
    tenantRequestIndex: index("client_service_request_items_tenant_request_idx").on(
      table.tenantId,
      table.requestId,
      table.serviceId,
    ),
  }),
);

export const clientServiceComments = pgTable(
  "client_service_comments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    body: text("body").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("client_service_comments_tenant_id_id_uidx").on(table.tenantId, table.id),
    idempotencyUnique: uniqueIndex("client_service_comments_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    tenantClientServiceIndex: index("client_service_comments_tenant_client_service_idx").on(
      table.tenantId,
      table.clientId,
      table.serviceId,
      table.createdAt,
      table.id,
    ),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    clientId: uuid("client_id").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currencyCode: text("currency_code").notNull(),
    method: text("method"),
    reference: text("reference"),
    status: text("status").default("pending").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    recordedBy: uuid("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdUnique: uniqueIndex("payments_tenant_id_id_uidx").on(table.tenantId, table.id),
    tenantInvoiceStatusIndex: index("payments_tenant_invoice_status_idx").on(
      table.tenantId,
      table.invoiceId,
      table.status,
      table.receivedAt,
      table.id,
    ),
  }),
);
