import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured, forbiddenPortal } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { setTrustedDatabaseContext, withDatabaseTransaction } from "../database/transaction-context";
import { EmployeeRequestContext } from "./employee-context";
import { CreateEmployeeDocumentRequest } from "./employee-documents.dto";
import type { StoredDocumentObject } from "./tenant-document-storage.service";

type EmployeeRow = { id: string; name: string };
export type EmployeeDocumentOptionRow = { id: string; name: string; email: string | null };
export type EmployeeDocumentRow = {
  id: string;
  client_id: string;
  client: string;
  title: string;
  file_name: string;
  file_type: string;
  size_bytes: number;
  category: string;
  uploaded_by: string;
  uploaded_by_id: string;
  updated_on: string;
  status: "active" | "archived";
  client_decision_status: "pending" | "approved" | "rejected";
  client_decision_at: string | null;
  client_decision_by: string | null;
  client_decision_comment: string | null;
  share_reason: string | null;
  recipient_tenant_admin_ids: string[];
  recipient_manager_ids: string[];
};

@Injectable()
export class EmployeeDocumentsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async options(context: EmployeeRequestContext) {
    return this.withEmployee(context, async (client, employee) => ({
      clients: await this.getAssignedClients(client, context.tenantId, employee.id),
      tenantAdmins: await this.getRecipients(client, context.tenantId, ["TENANT_OWNER", "TENANT_ADMIN"]),
      managers: await this.getRecipients(client, context.tenantId, ["MANAGER"]),
    }));
  }

  async list(context: EmployeeRequestContext): Promise<readonly EmployeeDocumentRow[]> {
    return this.withEmployee(context, (client) => this.getDocuments(client, context.tenantId, context.membershipId));
  }

  async getDocumentStorageObject(context: EmployeeRequestContext, documentId: string): Promise<StoredDocumentObject> {
    return this.withEmployee(context, async (client) => {
      const result = await client.query<{ storage_bucket: string | null; storage_key: string | null }>(
        `
          select d.storage_bucket, d.storage_key
          from public.tenant_documents d
          where d.tenant_id = $1 and d.id = $2 and d.status = 'active'
            and (d.created_by = $3 or exists (
              select 1 from public.tenant_document_recipients recipient
              where recipient.tenant_id = d.tenant_id and recipient.document_id = d.id and recipient.recipient_membership_id = $3
            ))
        `,
        [context.tenantId, documentId, context.membershipId],
      );
      const object = result.rows[0];
      if (!object?.storage_bucket || !object.storage_key) throw new ConflictException({ code: "DOCUMENT_FILE_NOT_AVAILABLE", message: "The file for this document is not available." });
      return { storageBucket: object.storage_bucket, storageKey: object.storage_key };
    });
  }

  async create(context: EmployeeRequestContext, input: CreateEmployeeDocumentRequest, storageBucket: string): Promise<EmployeeDocumentRow> {
    return this.withEmployee(context, async (client, employee) => {
      await this.assertAssignedClient(client, context.tenantId, employee.id, input.clientId);
      const recipients = await this.assertRecipients(client, context.tenantId, input.recipientTenantAdminIds, input.recipientManagerIds);
      const result = await client.query<{ id: string }>(
        `
          insert into public.tenant_documents (
            tenant_id, client_id, title, file_name, file_type, size_bytes, category,
            storage_bucket, storage_key, content_type, idempotency_key, metadata, created_by
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            jsonb_build_object(
              'clientDecisionStatus', 'pending',
              'clientVisible', false,
              'employeeUpload', true
            ),
            $12
          )
          on conflict (tenant_id, created_by, idempotency_key) where idempotency_key is not null do nothing
          returning id::text
        `,
        [context.tenantId, input.clientId, input.title, input.fileName, input.fileType, input.sizeBytes, input.category, storageBucket, input.storageKey, input.contentType, input.idempotencyKey ?? null, context.membershipId],
      );
      const idempotencyKey = input.idempotencyKey;
      let documentId: string | undefined = result.rows[0]?.id;
      const created = Boolean(documentId);
      if (!documentId && idempotencyKey) {
        documentId = await this.findDocumentIdByIdempotencyKey(client, context.tenantId, context.membershipId, idempotencyKey);
      }
      if (!documentId) throw new ConflictException({ code: "DOCUMENT_CREATE_FAILED", message: "Document could not be created." });
      if (!created) return this.getDocumentOrThrow(client, context.tenantId, context.membershipId, documentId);

      if (recipients.length) {
        await client.query(
          `
            insert into public.tenant_document_recipients (
              tenant_id, document_id, recipient_membership_id, recipient_role, created_by
            )
            select $1::uuid, $2::uuid, recipient_id, recipient_role, $3::uuid
            from unnest($4::uuid[], $5::text[]) as selected(recipient_id, recipient_role)
            on conflict (tenant_id, document_id, recipient_membership_id) do nothing
          `,
          [context.tenantId, documentId, context.membershipId, recipients.map((item) => item.id), recipients.map((item) => item.role)],
        );
      }

      await client.query(
        "select audit.write_audit_event('EMPLOYEE_DOCUMENT_UPLOADED', 'document', $1::uuid, 'succeeded', null, $2::jsonb)",
        [documentId, JSON.stringify({ clientId: input.clientId, title: input.title, recipientCount: recipients.length })],
      );
      await this.notifyRecipients(client, context, documentId, input.title, recipients.map((item) => item.id));
      return this.getDocumentOrThrow(client, context.tenantId, context.membershipId, documentId);
    });
  }

  private async getAssignedClients(client: PoolClient, tenantId: string, employeeId: string): Promise<readonly EmployeeDocumentOptionRow[]> {
    const result = await client.query<EmployeeDocumentOptionRow>(
      `
        select distinct c.id::text as id, c.display_name as name, null::text as email
        from public.task_assignments ta
        join public.tasks t on t.tenant_id = ta.tenant_id and t.id = ta.task_id
        join public.clients c on c.tenant_id = t.tenant_id and c.id = t.client_id
        where ta.tenant_id = $1
          and ta.employee_id = $2
          and ta.status in ('active', 'submitted')
          and t.status <> 'cancelled'
        order by c.display_name asc
      `,
      [tenantId, employeeId],
    );
    return result.rows;
  }

  private async getRecipients(client: PoolClient, tenantId: string, roles: readonly string[]): Promise<readonly EmployeeDocumentOptionRow[]> {
    const result = await client.query<EmployeeDocumentOptionRow>(
      `
        select distinct tm.id::text as id, tm.display_name as name, u.email
        from public.tenant_memberships tm
        join public.users u on u.id = tm.user_id
        join public.membership_roles mr on mr.tenant_id = tm.tenant_id and mr.membership_id = tm.id and mr.status = 'active'
        join public.roles r on r.id = mr.role_id
        where tm.tenant_id = $1
          and tm.status = 'active'
          and r.code = any($2::text[])
        order by tm.display_name asc
      `,
      [tenantId, roles],
    );
    return result.rows;
  }

  private async assertAssignedClient(client: PoolClient, tenantId: string, employeeId: string, clientId: string): Promise<void> {
    const result = await client.query(
      `
        select 1
        from public.task_assignments ta
        join public.tasks t on t.tenant_id = ta.tenant_id and t.id = ta.task_id
        where ta.tenant_id = $1
          and ta.employee_id = $2
          and t.client_id = $3
          and ta.status in ('active', 'submitted')
          and t.status <> 'cancelled'
        limit 1
      `,
      [tenantId, employeeId, clientId],
    );
    if (!result.rowCount) throw forbiddenPortal();
  }

  private async assertRecipients(
    client: PoolClient,
    tenantId: string,
    tenantAdminIds: readonly string[],
    managerIds: readonly string[],
  ): Promise<readonly { id: string; role: "TENANT_ADMIN" | "MANAGER" }[]> {
    const selected = [
      ...tenantAdminIds.map((id) => ({ id, role: "TENANT_ADMIN" as const })),
      ...managerIds.map((id) => ({ id, role: "MANAGER" as const })),
    ];
    const unique = Array.from(new Map(selected.map((item) => [item.id, item])).values());
    if (!unique.length) throw new ConflictException({ code: "DOCUMENT_RECIPIENT_REQUIRED", message: "Select at least one recipient." });
    const result = await client.query<{ id: string; role: "TENANT_ADMIN" | "MANAGER" }>(
      `
        select tm.id::text as id,
          case when bool_or(r.code in ('TENANT_OWNER', 'TENANT_ADMIN')) then 'TENANT_ADMIN' else 'MANAGER' end as role
        from public.tenant_memberships tm
        join public.membership_roles mr on mr.tenant_id = tm.tenant_id and mr.membership_id = tm.id and mr.status = 'active'
        join public.roles r on r.id = mr.role_id
        where tm.tenant_id = $1
          and tm.status = 'active'
          and tm.id = any($2::uuid[])
          and r.code in ('TENANT_OWNER', 'TENANT_ADMIN', 'MANAGER')
        group by tm.id
      `,
      [tenantId, unique.map((item) => item.id)],
    );
    const allowed = new Map(result.rows.map((row) => [row.id, row.role]));
    for (const item of unique) {
      if (allowed.get(item.id) !== item.role) throw forbiddenPortal();
    }
    return unique;
  }

  private async getDocuments(client: PoolClient, tenantId: string, membershipId: string): Promise<readonly EmployeeDocumentRow[]> {
    const result = await client.query<EmployeeDocumentRow>(
      `
        select d.id::text, d.client_id::text, c.display_name as client, d.title, d.file_name, d.file_type,
               d.size_bytes, d.category, coalesce(owner.display_name, 'System') as uploaded_by,
               coalesce(d.created_by::text, '') as uploaded_by_id, d.updated_at::text as updated_on, d.status,
               coalesce(d.metadata->>'clientDecisionStatus', 'pending') as client_decision_status,
               d.metadata->>'clientDecisionAt' as client_decision_at,
               d.metadata->>'clientDecisionBy' as client_decision_by,
               d.metadata->>'clientDecisionComment' as client_decision_comment,
               nullif(d.metadata->>'shareReason', '') as share_reason,
               coalesce(array_remove(array_agg(distinct tdr.recipient_membership_id::text) filter (where tdr.recipient_role = 'TENANT_ADMIN'), null), '{}'::text[]) as recipient_tenant_admin_ids,
               coalesce(array_remove(array_agg(distinct tdr.recipient_membership_id::text) filter (where tdr.recipient_role = 'MANAGER'), null), '{}'::text[]) as recipient_manager_ids
        from public.tenant_documents d
        join public.clients c on c.id = d.client_id and c.tenant_id = d.tenant_id
        left join public.tenant_memberships owner on owner.id = d.created_by and owner.tenant_id = d.tenant_id
        left join public.tenant_document_recipients tdr on tdr.tenant_id = d.tenant_id and tdr.document_id = d.id
        where d.tenant_id = $1
          and (
            d.created_by = $2
            or exists (
              select 1 from public.tenant_document_recipients my_access
              where my_access.tenant_id = d.tenant_id
                and my_access.document_id = d.id
                and my_access.recipient_membership_id = $2
            )
          )
        group by d.id, c.display_name, owner.display_name
        order by d.updated_at desc, d.id desc
      `,
      [tenantId, membershipId],
    );
    return result.rows;
  }

  private async getDocumentOrThrow(client: PoolClient, tenantId: string, membershipId: string, documentId: string): Promise<EmployeeDocumentRow> {
    const document = (await this.getDocuments(client, tenantId, membershipId)).find((row) => row.id === documentId);
    if (!document) throw new ConflictException({ code: "DOCUMENT_CREATE_FAILED", message: "Document could not be loaded." });
    return document;
  }

  private async findDocumentIdByIdempotencyKey(client: PoolClient, tenantId: string, membershipId: string, idempotencyKey: string): Promise<string | undefined> {
    const result = await client.query<{ id: string }>(
      `select id::text from public.tenant_documents where tenant_id = $1 and created_by = $2 and idempotency_key = $3`,
      [tenantId, membershipId, idempotencyKey],
    );
    return result.rows[0]?.id;
  }

  private async notifyRecipients(
    client: PoolClient,
    context: EmployeeRequestContext,
    documentId: string,
    title: string,
    recipientMembershipIds: readonly string[],
  ): Promise<void> {
    if (!recipientMembershipIds.length) return;
    await client.query(
      `
        with inserted as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
          )
          values (
            'EMPLOYEE_DOCUMENT_SHARED',
            'Document shared',
            'A document "' || $4::text || '" was shared with you.',
            'INFO',
            $1::uuid,
            $2::uuid,
            'document',
            $3::uuid,
            '/admin/documents',
            jsonb_build_object('documentId', $3::uuid, 'title', $4::text),
            'employee-document-shared:' || $3::uuid::text
          )
          on conflict (idempotency_key) do update set idempotency_key = public.notifications.idempotency_key
          returning id
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select inserted.id, tm.user_id
        from inserted
        join public.tenant_memberships tm on tm.tenant_id = $1::uuid and tm.id = any($5::uuid[])
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, context.userId, documentId, title, recipientMembershipIds],
    );
  }

  private async getEmployee(client: PoolClient, context: EmployeeRequestContext): Promise<EmployeeRow> {
    const result = await client.query<EmployeeRow>(
      `
        select e.id::text, coalesce(tm.display_name, e.employee_code) as name
        from public.employees e
        join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id
        where e.tenant_id = $1 and e.membership_id = $2 and e.employment_status = 'active'
        limit 1
      `,
      [context.tenantId, context.membershipId],
    );
    const employee = result.rows[0];
    if (!employee) throw forbiddenPortal();
    return employee;
  }

  private async withEmployee<T>(
    context: EmployeeRequestContext,
    work: (client: PoolClient, employee: EmployeeRow) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const employee = await this.getEmployee(client, context);
      await setTrustedDatabaseContext(client, { ...context, employeeId: employee.id });
      return work(client, employee);
    });
  }
}
