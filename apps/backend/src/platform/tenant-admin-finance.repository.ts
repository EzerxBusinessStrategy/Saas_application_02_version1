import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { CreateTaskInvoiceRequest, CreateTenantDocumentRequest, CreateTenantInvoiceRequest } from "./tenant-admin-finance.dto";
import type { StoredDocumentObject } from "./tenant-document-storage.service";

export type TenantDocumentRow = {
  readonly id: string;
  readonly clientId: string | null;
  readonly client: string;
  readonly title: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly sizeBytes: number;
  readonly category: string;
  readonly uploadedBy: string;
  readonly updatedOn: string;
  readonly status: "active" | "archived";
  readonly clientDecisionStatus: "pending" | "approved" | "rejected";
  readonly clientDecisionAt: string | null;
  readonly clientDecisionBy: string | null;
  readonly clientDecisionComment: string | null;
  readonly shareReason: string | null;
  readonly storageKey: string | null;
};

export type TenantInvoiceRow = {
  readonly id: string;
  readonly clientId: string;
  readonly client: string;
  readonly taskTitle: string | null;
  readonly invoiceNumber: string;
  readonly issuedOn: string;
  readonly dueOn: string | null;
  readonly currency: string;
  readonly amount: number;
  readonly status: string;
  readonly visibility: "client" | "internal";
  readonly uploadedBy: string;
  readonly updatedOn: string;
};

export type TenantBillableTaskEntryRow = {
  readonly id: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly clientId: string;
  readonly client: string;
  readonly currency: string;
  readonly grossAmount: number;
  readonly discountAmount: number;
  readonly netAmount: number;
};

@Injectable()
export class TenantAdminFinanceRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async listDocuments(context: TenantAdminRequestContext, clientId?: string): Promise<readonly TenantDocumentRow[]> {
    return this.withContext(context, (client) => this.getDocuments(client, context.tenantId, clientId, context.membershipId));
  }

  async getDocumentStorageObject(context: TenantAdminRequestContext, documentId: string): Promise<StoredDocumentObject> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ storage_bucket: string | null; storage_key: string | null }>(
        `select storage_bucket, storage_key from public.tenant_documents where tenant_id = $1 and id = $2 and status = 'active'`,
        [context.tenantId, documentId],
      );
      const object = result.rows[0];
      if (!object?.storage_bucket || !object.storage_key) throw new ConflictException({ code: "DOCUMENT_FILE_NOT_AVAILABLE", message: "The file for this document is not available." });
      return { storageBucket: object.storage_bucket, storageKey: object.storage_key };
    });
  }

  async createDocument(context: TenantAdminRequestContext, input: CreateTenantDocumentRequest, storageBucket: string): Promise<TenantDocumentRow> {
    return this.withContext(context, async (client) => {
      if (input.clientId) {
        await this.assertClient(client, context.tenantId, input.clientId);
      }
      const result = await client.query<{ id: string }>(
        `
          insert into public.tenant_documents (
            tenant_id,
            client_id,
            title,
            file_name,
            file_type,
            size_bytes,
            category,
            storage_bucket,
            storage_key,
            content_type,
            idempotency_key,
            metadata,
            created_by
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            jsonb_build_object(
              'clientDecisionStatus', 'pending',
              'clientVisible', $14::boolean,
              'shareReason', $13::text
            ),
            $12
          )
          on conflict (tenant_id, created_by, idempotency_key) where idempotency_key is not null do nothing
          returning id::text
        `,
        [context.tenantId, input.clientId ?? null, input.title, input.fileName, input.fileType, input.sizeBytes, input.category, storageBucket, input.storageKey, input.contentType, input.idempotencyKey ?? null, context.membershipId, input.shareReason ?? "", Boolean(input.clientId)],
      ).catch((error: unknown) => {
        if (isUndefinedTable(error)) {
          throw new ConflictException({
            code: "DOCUMENT_STORAGE_NOT_READY",
            message: "Document storage is not ready yet.",
          });
        }
        throw error;
      });
      const idempotencyKey = input.idempotencyKey;
      let id: string | undefined = result.rows[0]?.id;
      const created = Boolean(id);
      if (!id && idempotencyKey) {
        id = await this.findDocumentIdByIdempotencyKey(client, context.tenantId, context.membershipId, idempotencyKey);
      }
      if (!id) throw new ConflictException({ code: "DOCUMENT_CREATE_FAILED", message: "Document could not be created." });
      if (!created) return this.getDocumentOrThrow(client, context.tenantId, id, context.membershipId);
      const employeeRecipientMembershipIds = await this.getEmployeeRecipientMembershipIds(client, context.tenantId, input.recipientEmployeeIds ?? []);
      if (employeeRecipientMembershipIds.length) {
        await client.query(
          `
            insert into public.tenant_document_recipients (
              tenant_id, document_id, recipient_membership_id, recipient_role, created_by
            )
            select $1::uuid, $2::uuid, unnest($3::uuid[]), 'EMPLOYEE', $4::uuid
            on conflict (tenant_id, document_id, recipient_membership_id) do nothing
          `,
          [context.tenantId, id, employeeRecipientMembershipIds, context.membershipId],
        );
        await this.notifyEmployeeDocumentShared(client, context, id, input.title, employeeRecipientMembershipIds);
      }
      await client.query(
        "select audit.write_audit_event('DOCUMENT_CREATED', 'document', $1::uuid, 'succeeded', null, $2::jsonb)",
        [id, JSON.stringify({ clientId: input.clientId ?? null, title: input.title, employeeRecipientCount: employeeRecipientMembershipIds.length })],
      );
      if (input.clientId) {
        await this.notifyClientDeliverableShared(client, context, id, input.clientId, input.title);
      }
      return this.getDocumentOrThrow(client, context.tenantId, id, context.membershipId);
    });
  }

  async listInvoices(context: TenantAdminRequestContext, clientId?: string): Promise<readonly TenantInvoiceRow[]> {
    return this.withContext(context, (client) => this.getInvoices(client, context.tenantId, clientId));
  }

  async createInvoice(context: TenantAdminRequestContext, input: CreateTenantInvoiceRequest, storageBucket: string): Promise<TenantInvoiceRow> {
    return this.withContext(context, async (client) => {
      await this.assertClient(client, context.tenantId, input.clientId);
      const financialYearId = await this.getCurrentFinancialYearId(client, context.tenantId);
      const result = await client.query<{ id: string }>(
        `
          insert into public.invoices (
            tenant_id,
            client_id,
            financial_year_id,
            invoice_number,
            issued_on,
            due_on,
            subtotal_amount,
            total_amount,
            currency_code,
            status,
            finalized_at,
            created_by,
            idempotency_key
          )
          values ($1, $2, $3, $4, $5, $6, $7, $7, $8, 'finalized', now(), $9, $10)
          on conflict (tenant_id, created_by, idempotency_key) where idempotency_key is not null do nothing
          returning id::text
        `,
        [
          context.tenantId,
          input.clientId,
          financialYearId,
          input.invoiceNumber,
          input.issuedOn,
          input.dueOn,
          input.amount,
          input.currencyCode,
          context.membershipId,
          input.idempotencyKey ?? null,
        ],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException({ code: "INVOICE_NUMBER_EXISTS", message: "This invoice number already exists." });
        }
        throw error;
      });
      const idempotencyKey = input.idempotencyKey;
      let id: string | undefined = result.rows[0]?.id;
      if (!id && idempotencyKey) {
        id = await this.findInvoiceIdByIdempotencyKey(client, context.tenantId, context.membershipId, idempotencyKey);
      }
      if (!id) throw new ConflictException({ code: "INVOICE_CREATE_FAILED", message: "Invoice could not be created." });
      if (!result.rows[0]?.id) return this.getInvoiceOrThrow(client, context.tenantId, id);
      await client.query(
        `
          insert into public.tenant_documents (
            tenant_id, client_id, title, file_name, file_type, size_bytes, category,
            storage_bucket, storage_key, content_type, metadata, created_by
          )
          values (
            $1, $2, 'Invoice ' || $3, $4, $5, $6, 'invoice',
            $7, $8, $9,
            jsonb_build_object(
               'invoiceId', $10::uuid,
              'documentKind', 'invoice_upload',
               'clientVisible', $11::boolean,
               'shareReason', case when $11::boolean then 'Invoice sent to client.' else 'Internal finance document.' end
            ),
            $12
          )
        `,
        [context.tenantId, input.clientId, input.invoiceNumber, input.fileName, input.fileType, input.sizeBytes, storageBucket, input.storageKey, input.contentType, id, input.visibility === "client", context.membershipId],
      );
      await client.query(
        "select audit.write_audit_event('INVOICE_CREATED', 'invoice', $1::uuid, 'succeeded', null, $2::jsonb)",
        [id, JSON.stringify({ clientId: input.clientId, invoiceNumber: input.invoiceNumber, amount: input.amount })],
      );
      if (input.visibility === "client") {
        await this.notifyClientInvoiceSent(client, context, id, input.clientId, input.invoiceNumber);
      }
      return this.getInvoiceOrThrow(client, context.tenantId, id);
    });
  }

  async listBillableTaskEntries(context: TenantAdminRequestContext): Promise<readonly TenantBillableTaskEntryRow[]> {
    return this.withContext(context, (client) => this.getBillableTaskEntries(client, context.tenantId));
  }

  async createInvoiceFromTask(context: TenantAdminRequestContext, input: CreateTaskInvoiceRequest): Promise<TenantInvoiceRow> {
    return this.withContext(context, async (client) => {
      const entryResult = await client.query<{
        id: string; task_id: string; task_title: string; client_id: string; currency_code: string; gross_amount: string; financial_year_id: string;
      }>(
        `select bte.id::text, bte.task_id::text, t.title as task_title, bte.client_id::text,
                bte.currency_code, bte.gross_amount, t.financial_year_id::text
         from public.billable_task_entries bte
         join public.tasks t on t.id = bte.task_id and t.tenant_id = bte.tenant_id
         where bte.tenant_id = $1 and bte.id = $2 and bte.status = 'approved_for_invoice'
         for update`,
        [context.tenantId, input.billableTaskEntryId],
      );
      const entry = entryResult.rows[0];
      if (!entry) throw new ConflictException({ code: "BILLABLE_TASK_NOT_AVAILABLE", message: "This task is no longer available for invoicing." });

      const grossAmount = Number(entry.gross_amount);
      const discountAmount = calculateDiscount(grossAmount, input.discountType, input.discountValue);
      const totalAmount = grossAmount - discountAmount;
      const invoiceResult = await client.query<{ id: string }>(
        `insert into public.invoices (
           tenant_id, client_id, financial_year_id, invoice_number, issued_on, due_on,
           subtotal_amount, discount_amount, tax_amount, total_amount, currency_code, status, created_by
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, 'draft', $11)
         returning id::text`,
        [context.tenantId, entry.client_id, entry.financial_year_id, input.invoiceNumber, input.issuedOn, input.dueOn, grossAmount, discountAmount, totalAmount, entry.currency_code, context.membershipId],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ConflictException({ code: "INVOICE_NUMBER_EXISTS", message: "This invoice number already exists." });
        throw error;
      });
      const invoiceId = invoiceResult.rows[0]?.id;
      if (!invoiceId) throw new ConflictException({ code: "INVOICE_CREATE_FAILED", message: "Invoice could not be created." });
      const itemResult = await client.query<{ id: string }>(
        `insert into public.invoice_items (
           tenant_id, invoice_id, task_id, billable_task_entry_id, service_id, description,
           quantity, unit_rate, gross_amount, discount_amount, tax_amount, net_amount
         )
         select $1, $2, bte.task_id, bte.id, t.service_id, t.title,
                bte.quantity, bte.unit_rate, bte.gross_amount, $3, 0, $4
         from public.billable_task_entries bte
         join public.tasks t on t.id = bte.task_id and t.tenant_id = bte.tenant_id
         where bte.tenant_id = $1 and bte.id = $5
         returning id::text`,
        [context.tenantId, invoiceId, discountAmount, totalAmount, entry.id],
      );
      const invoiceItemId = itemResult.rows[0]?.id;
      if (!invoiceItemId) throw new ConflictException({ code: "INVOICE_ITEM_CREATE_FAILED", message: "Invoice item could not be created." });
      await client.query(
        `update public.billable_task_entries
         set discount_type = $3, discount_value = $4, discount_amount = $5, net_amount = $6,
             status = 'invoiced', invoice_item_id = $7, updated_at = now()
         where tenant_id = $1 and id = $2`,
        [context.tenantId, entry.id, input.discountType ?? null, input.discountValue || null, discountAmount, totalAmount, invoiceItemId],
      );
      await client.query(
        "select audit.write_audit_event('INVOICE_CREATED_FROM_TASK', 'invoice', $1::uuid, 'succeeded', null, $2::jsonb)",
        [invoiceId, JSON.stringify({ taskId: entry.task_id, billableTaskEntryId: entry.id, discountAmount, totalAmount })],
      );
      return this.getInvoiceOrThrow(client, context.tenantId, invoiceId);
    });
  }

  async sendInvoice(context: TenantAdminRequestContext, invoiceId: string): Promise<TenantInvoiceRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ client_id: string; invoice_number: string }>(
        `update public.invoices set status = 'issued', finalized_at = coalesce(finalized_at, now()), updated_at = now()
         where tenant_id = $1 and id = $2 and status = 'draft'
         returning client_id::text, invoice_number`,
        [context.tenantId, invoiceId],
      );
      const invoice = result.rows[0];
      if (!invoice) throw new ConflictException({ code: "INVOICE_NOT_SENDABLE", message: "Only draft invoices can be sent." });
      try {
        await client.query(
          `
            insert into public.tenant_documents (
              tenant_id, client_id, title, file_name, file_type, size_bytes,
              category, metadata, created_by
            )
            select
              $1::uuid,
              $2::uuid,
              'Invoice ' || $3::text,
              $3::text || '.pdf',
              'PDF',
              0,
              'invoice',
              jsonb_build_object(
                'invoiceId', $4::uuid,
                'documentKind', 'invoice_pdf',
                'clientVisible', true,
                'shareReason', 'Invoice sent to client.'
              ),
              $5::uuid
            where not exists (
              select 1
              from public.tenant_documents d
              where d.tenant_id = $1
                and d.metadata->>'invoiceId' = $4::text
            )
          `,
          [context.tenantId, invoice.client_id, invoice.invoice_number, invoiceId, context.membershipId],
        );
        await this.notifyClientInvoiceSent(client, context, invoiceId, invoice.client_id, invoice.invoice_number);
        await client.query(
          "select audit.write_audit_event('INVOICE_SENT', 'invoice', $1::uuid, 'succeeded', null, $2::jsonb)",
          [invoiceId, JSON.stringify({ clientId: invoice.client_id, invoiceNumber: invoice.invoice_number })],
        );
      } catch (error: unknown) {
        if (isUndefinedTable(error)) {
          throw new ConflictException({
            code: "INVOICE_DOCUMENT_STORAGE_NOT_READY",
            message: "Invoice sending requires migrations 0043_tenant_document_metadata.sql and 0046_employee_document_recipients.sql.",
          });
        }
        if (isPermissionDenied(error)) {
          throw new ConflictException({
            code: "INVOICE_DOCUMENT_STORAGE_ACCESS_DENIED",
            message: "Invoice document storage is not available to the application database role. Apply migration 0046_employee_document_recipients.sql.",
          });
        }
        throw error;
      }
      return this.getInvoiceOrThrow(client, context.tenantId, invoiceId);
    });
  }

  private async getDocuments(client: PoolClient, tenantId: string, clientId?: string, membershipId?: string): Promise<readonly TenantDocumentRow[]> {
    const result = await client.query<{
      id: string; client_id: string | null; client: string; title: string; file_name: string; file_type: string; size_bytes: number; category: string; storage_key: string | null; uploaded_by: string; updated_on: string; status: "active" | "archived"; client_decision_status: "pending" | "approved" | "rejected"; client_decision_at: string | null; client_decision_by: string | null; client_decision_comment: string | null; share_reason: string | null;
    }>(
      `
        select d.id::text, d.client_id::text, coalesce(c.display_name, 'Not linked') as client, d.title, d.file_name, d.file_type, d.storage_key,
               d.size_bytes, d.category, coalesce(tm.display_name, 'System') as uploaded_by,
               d.updated_at::text as updated_on, d.status,
               coalesce(d.metadata->>'clientDecisionStatus', 'pending') as client_decision_status,
               d.metadata->>'clientDecisionAt' as client_decision_at,
               d.metadata->>'clientDecisionBy' as client_decision_by,
               d.metadata->>'clientDecisionComment' as client_decision_comment,
               nullif(d.metadata->>'shareReason', '') as share_reason
        from public.tenant_documents d
        left join public.clients c on c.id = d.client_id and c.tenant_id = d.tenant_id
        left join public.tenant_memberships tm on tm.id = d.created_by and tm.tenant_id = d.tenant_id
        where d.tenant_id = $1
          and ($2::uuid is null or d.client_id = $2)
          and (
            coalesce(d.metadata->>'employeeUpload', 'false') <> 'true'
            or d.created_by = $3
            or exists (
              select 1
              from public.tenant_document_recipients tdr
              where tdr.tenant_id = d.tenant_id
                and tdr.document_id = d.id
                and tdr.recipient_membership_id = $3
            )
          )
        order by d.updated_at desc, d.id desc
      `,
      [tenantId, clientId ?? null, membershipId ?? null],
    ).catch((error: unknown) => {
      if (isUndefinedTable(error)) {
        return { rows: [] } as { rows: never[] };
      }
      throw error;
    });
    return result.rows.map((row) => ({
      id: row.id, clientId: row.client_id, client: row.client, title: row.title, fileName: row.file_name,
      fileType: row.file_type, sizeBytes: Number(row.size_bytes), category: row.category,
      uploadedBy: row.uploaded_by, updatedOn: row.updated_on, status: row.status,
      clientDecisionStatus: row.client_decision_status,
      clientDecisionAt: row.client_decision_at,
      clientDecisionBy: row.client_decision_by,
      clientDecisionComment: row.client_decision_comment,
      shareReason: row.share_reason,
      storageKey: row.storage_key,
    }));
  }

  private async getInvoices(client: PoolClient, tenantId: string, clientId?: string): Promise<readonly TenantInvoiceRow[]> {
    const result = await client.query<{
      id: string; client_id: string; client: string; task_title: string | null; invoice_number: string; issued_on: string; due_on: string | null; currency_code: string; total_amount: string; status: string; uploaded_by: string; updated_on: string;
    }>(
      `
        select i.id::text, i.client_id::text, c.display_name as client, task_item.task_title, i.invoice_number,
               i.issued_on::text, i.due_on::text, i.currency_code, i.total_amount,
               i.status, coalesce(tm.display_name, 'System') as uploaded_by, i.updated_at::text as updated_on
        from public.invoices i
        join public.clients c on c.id = i.client_id and c.tenant_id = i.tenant_id
        left join public.tenant_memberships tm on tm.id = i.created_by and tm.tenant_id = i.tenant_id
        left join lateral (
          select string_agg(t.title, ', ' order by t.title) as task_title
          from public.invoice_items ii
          join public.tasks t on t.tenant_id = ii.tenant_id and t.id = ii.task_id
          where ii.tenant_id = i.tenant_id and ii.invoice_id = i.id
        ) task_item on true
        where i.tenant_id = $1
          and ($2::uuid is null or i.client_id = $2)
        order by i.issued_on desc, i.created_at desc
      `,
      [tenantId, clientId ?? null],
    );
    return result.rows.map((row) => ({
      id: row.id, clientId: row.client_id, client: row.client, taskTitle: row.task_title, invoiceNumber: row.invoice_number,
      issuedOn: row.issued_on, dueOn: row.due_on, currency: row.currency_code, amount: Number(row.total_amount),
      status: row.status, visibility: "client", uploadedBy: row.uploaded_by, updatedOn: row.updated_on,
    }));
  }

  private async getEmployeeRecipientMembershipIds(client: PoolClient, tenantId: string, employeeIds: readonly string[]): Promise<readonly string[]> {
    if (!employeeIds.length) return [];
    const result = await client.query<{ membership_id: string }>(
      `
        select e.membership_id::text
        from public.employees e
        join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id
        where e.tenant_id = $1
          and e.id = any($2::uuid[])
          and e.employment_status = 'active'
          and tm.status = 'active'
      `,
      [tenantId, employeeIds],
    );
    if (result.rowCount !== new Set(employeeIds).size) {
      throw new ConflictException({ code: "DOCUMENT_RECIPIENT_INVALID", message: "One or more employee recipients are invalid." });
    }
    return result.rows.map((row) => row.membership_id);
  }

  private async notifyEmployeeDocumentShared(
    client: PoolClient,
    context: TenantAdminRequestContext,
    documentId: string,
    title: string,
    recipientMembershipIds: readonly string[],
  ): Promise<void> {
    await client.query(
      `
        with inserted as (
          insert into public.notifications (type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key)
          values ('DOCUMENT_SHARED', 'Document shared', 'A document "' || $4::text || '" was shared with you.', 'INFO', $1::uuid, $2::uuid, 'document', $3::uuid, '/employee/documents', jsonb_build_object('documentId', $3::uuid, 'title', $4::text), 'document-shared:' || $3::uuid::text)
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        ),
        notification_row as (
          select id from inserted
          union all
          select id from public.notifications where idempotency_key = 'document-shared:' || $3::uuid::text
          limit 1
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, tm.user_id
        from notification_row
        join public.tenant_memberships tm on tm.tenant_id = $1::uuid and tm.id = any($5::uuid[])
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, context.userId, documentId, title, recipientMembershipIds],
    );
  }

  private async getBillableTaskEntries(client: PoolClient, tenantId: string): Promise<readonly TenantBillableTaskEntryRow[]> {
    const result = await client.query<{
      id: string; task_id: string; task_title: string; client_id: string; client: string; currency_code: string;
      gross_amount: string; discount_amount: string; net_amount: string;
    }>(
      `select bte.id::text, bte.task_id::text, t.title as task_title, bte.client_id::text,
              c.display_name as client, bte.currency_code, bte.gross_amount, bte.discount_amount, bte.net_amount
       from public.billable_task_entries bte
       join public.tasks t on t.id = bte.task_id and t.tenant_id = bte.tenant_id
       join public.clients c on c.id = bte.client_id and c.tenant_id = bte.tenant_id
         where bte.tenant_id = $1 and bte.status = 'approved_for_invoice'
       order by bte.created_at desc`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: row.id, taskId: row.task_id, taskTitle: row.task_title, clientId: row.client_id, client: row.client,
      currency: row.currency_code, grossAmount: Number(row.gross_amount), discountAmount: Number(row.discount_amount), netAmount: Number(row.net_amount),
    }));
  }

  private async notifyClientInvoiceSent(client: PoolClient, context: TenantAdminRequestContext, invoiceId: string, clientId: string, invoiceNumber: string): Promise<void> {
    await client.query(
      `with inserted as (
         insert into public.notifications (type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key)
         values ('CLIENT_INVOICE_SENT', 'Invoice sent', 'Invoice ' || $5::text || ' is ready. Please share your feedback on the completed work.', 'INFO', $1::uuid, $2::uuid, 'invoice', $3::uuid, '/client/invoices', jsonb_build_object('clientId', $4::uuid, 'requestFeedback', true), 'client-invoice-sent:' || $3::uuid::text)
         on conflict (idempotency_key) where idempotency_key is not null do update set id = public.notifications.id
         returning id
       )
       insert into public.notification_recipients (notification_id, recipient_user_id)
       select inserted.id, cpa.user_id
       from inserted
       join public.client_portal_accounts cpa on cpa.tenant_id = $1::uuid and cpa.client_id = $4::uuid and cpa.status = 'active'
       on conflict (notification_id, recipient_user_id) do nothing`,
      [context.tenantId, context.userId, invoiceId, clientId, invoiceNumber],
    );
  }

  private async notifyClientDeliverableShared(
    client: PoolClient,
    context: TenantAdminRequestContext,
    documentId: string,
    clientId: string,
    title: string,
  ): Promise<void> {
    await client.query(
      `with inserted as (
         insert into public.notifications (
           type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
         )
         values (
           'CLIENT_DELIVERABLE_SHARED',
           'New deliverable shared',
           'A new deliverable "' || $5::text || '" is ready for your review.',
           'INFO',
           $1::uuid,
           $2::uuid,
           'document',
           $3::uuid,
           '/client/deliverables',
           jsonb_build_object('clientId', $4::uuid, 'documentId', $3::uuid, 'title', $5::text),
           'client-deliverable-shared:' || $3::uuid::text
         )
         on conflict (idempotency_key) where idempotency_key is not null do nothing
         returning id
       )
       insert into public.notification_recipients (notification_id, recipient_user_id)
       select inserted.id, cpa.user_id
       from inserted
       join public.client_portal_accounts cpa
         on cpa.tenant_id = $1::uuid
        and cpa.client_id = $4::uuid
        and cpa.status = 'active'
       on conflict (notification_id, recipient_user_id) do nothing`,
      [context.tenantId, context.userId, documentId, clientId, title],
    );
  }

  private async getDocumentOrThrow(client: PoolClient, tenantId: string, id: string, membershipId?: string): Promise<TenantDocumentRow> {
    const row = (await this.getDocuments(client, tenantId, undefined, membershipId)).find((document) => document.id === id);
    if (!row) throw new ConflictException({ code: "DOCUMENT_LOAD_FAILED", message: "Document could not be loaded." });
    return row;
  }

  private async findDocumentIdByIdempotencyKey(client: PoolClient, tenantId: string, membershipId: string, idempotencyKey: string): Promise<string | undefined> {
    const result = await client.query<{ id: string }>(
      `select id::text from public.tenant_documents where tenant_id = $1 and created_by = $2 and idempotency_key = $3`,
      [tenantId, membershipId, idempotencyKey],
    );
    return result.rows[0]?.id;
  }

  private async findInvoiceIdByIdempotencyKey(client: PoolClient, tenantId: string, membershipId: string, idempotencyKey: string): Promise<string | undefined> {
    const result = await client.query<{ id: string }>(
      `select id::text from public.invoices where tenant_id = $1 and created_by = $2 and idempotency_key = $3`,
      [tenantId, membershipId, idempotencyKey],
    );
    return result.rows[0]?.id;
  }

  private async getInvoiceOrThrow(client: PoolClient, tenantId: string, id: string): Promise<TenantInvoiceRow> {
    const row = (await this.getInvoices(client, tenantId)).find((invoice) => invoice.id === id);
    if (!row) throw new ConflictException({ code: "INVOICE_LOAD_FAILED", message: "Invoice could not be loaded." });
    return row;
  }

  private async assertClient(client: PoolClient, tenantId: string, clientId: string): Promise<void> {
    const result = await client.query("select 1 from public.clients where tenant_id = $1 and id = $2 and status in ('active', 'onboarding')", [tenantId, clientId]);
    if (!result.rowCount) throw new ConflictException({ code: "CLIENT_NOT_AVAILABLE", message: "Select an available client." });
  }

  private async getCurrentFinancialYearId(client: PoolClient, tenantId: string): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      `
        select id::text
        from public.tenant_financial_years
        where tenant_id = $1
          and status <> 'cancelled'
          and current_date between start_date and end_date
        order by (country_code = (select country from public.tenants where id = $1)) desc, start_date desc
        limit 1
      `,
      [tenantId],
    );
    return result.rows[0]?.id ?? null;
  }

  private async withContext<T>(context: TenantAdminRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isUndefinedTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42501";
}

function calculateDiscount(grossAmount: number, type: "percentage" | "fixed" | undefined, value: number): number {
  if (!type || value <= 0) return 0;
  const amount = type === "percentage" ? grossAmount * (value / 100) : value;
  return Math.min(grossAmount, Math.round(amount * 100) / 100);
}
