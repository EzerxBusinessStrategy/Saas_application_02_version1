import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { yearlyOccurrenceCount, type ServiceBlueprintFrequency } from "./service-blueprint-recurrence";
import {
  ClientPortalRequestContext,
  ClientPortalScope,
  resolveClientPortalScope,
} from "./client-portal-context";
import {
  AcceptClientServiceRequest,
  ClientServiceCatalogueQuery,
  ClientServiceCatalogueResponseDto,
  ClientServiceRequestDto,
  CreateClientServiceRequest,
  RejectClientServiceRequest,
} from "./client-service-requests.dto";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import { TenantAdminClientServiceActivationRepository } from "./tenant-admin-client-service-activation.repository";
import { ActivateClientServicesRequest } from "./tenant-admin-client-service-activation.dto";
import { TenantAdminServiceBlueprintsRepository } from "./tenant-admin-service-blueprints.repository";

type RequestRow = {
  id: string;
  kind: "catalogue" | "custom";
  title: string;
  description: string;
  status: ClientServiceRequestDto["status"];
  client_id: string;
  client_name: string;
  country_code: string;
  currency_code: string;
  estimated_total: string;
  review_remarks: string | null;
  submitted_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  snapshot: unknown;
};

type ItemRow = {
  service_id: string;
  service_name: string;
  assigned_employee_id: string | null;
  task_snapshot: unknown;
};

@Injectable()
export class ClientServiceRequestsRepository {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool | null,
    @Inject(TenantAdminServiceBlueprintsRepository)
    private readonly blueprints: TenantAdminServiceBlueprintsRepository,
    @Inject(TenantAdminClientServiceActivationRepository)
    private readonly activation: TenantAdminClientServiceActivationRepository,
  ) {}

  async getCatalogue(
    context: ClientPortalRequestContext,
    query: ClientServiceCatalogueQuery,
  ): Promise<ClientServiceCatalogueResponseDto> {
    return this.withClientPortal(context, async (client, scope) => {
      const clientRow = await client.query<{ display_name: string }>(
        "select display_name from public.clients where tenant_id = $1 and id = $2",
        [scope.tenantId, scope.clientId],
      );
      const services = await client.query<{ id: string }>(
        "select id::text from public.services where tenant_id = $1 and status = 'active' order by lower(name)",
        [scope.tenantId],
      );
      const active = await client.query<{ service_id: string }>(
        "select service_id::text from public.engagements where tenant_id = $1 and client_id = $2 and status in ('draft', 'active')",
        [scope.tenantId, scope.clientId],
      );
      const requested = await client.query<{ service_id: string }>(
        `
          select csri.service_id::text
          from public.client_service_request_items csri
          join public.client_service_requests csr
            on csr.tenant_id = csri.tenant_id
           and csr.id = csri.request_id
          where csr.tenant_id = $1
            and csr.client_id = $2
            and csr.status = 'submitted'
        `,
        [scope.tenantId, scope.clientId],
      );
      const activeIds = new Set(active.rows.map((row) => row.service_id));
      const requestedIds = new Set(requested.rows.map((row) => row.service_id));
      const items = [];
      for (const row of services.rows) {
        const blueprint = await this.blueprints.loadBlueprint(
          client,
          scope.tenantId,
          row.id,
          query.countryCode,
          query.currencyCode,
        );
        if (!blueprint || !blueprint.tasks.length) continue;
        items.push({
          serviceId: blueprint.serviceId,
          name: blueprint.name,
          code: blueprint.code,
          estimatedAnnualTotal: blueprint.estimatedAnnualTotal,
          currencyCode: blueprint.currencyCode,
          alreadyActive: activeIds.has(blueprint.serviceId),
          alreadyRequested: requestedIds.has(blueprint.serviceId),
          tasks: blueprint.tasks.map((task) => ({
            taskType: task.taskType,
            frequency: task.frequency,
            dueRule: task.dueRule,
            unitType: task.unitType,
            rateAmount: task.rateAmount,
            taxCode: task.taxCode,
            rateCardItemId: task.rateCardItemId,
            calendarRuleId: task.calendarRuleId,
          })),
        });
      }
      return {
        clientId: scope.clientId,
        clientName: clientRow.rows[0]?.display_name ?? "Client",
        services: items,
      };
    });
  }

  async listForClient(context: ClientPortalRequestContext): Promise<readonly ClientServiceRequestDto[]> {
    return this.withClientPortal(context, async (client, scope) => {
      const rows = await this.listRows(client, scope.tenantId, { clientId: scope.clientId });
      return Promise.all(rows.map((row) => this.mapRequest(client, scope.tenantId, row, false)));
    });
  }

  async create(
    context: ClientPortalRequestContext,
    input: CreateClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.withClientPortal(context, async (client, scope) => {
      const fingerprint = requestFingerprint(scope.clientId, input);
      const existing = await this.loadByIdempotency(client, scope.tenantId, scope.clientId, input.idempotencyKey);
      if (existing) {
        if (existing.request_fingerprint !== fingerprint) {
          throw new ConflictException({
            code: "CLIENT_SERVICE_REQUEST_IDEMPOTENCY_CONFLICT",
            message: "This request key was already used with different details.",
          });
        }
        return this.mapRequest(client, scope.tenantId, existing, true);
      }

      const snapshotServices = input.kind === "catalogue" ? await this.buildSnapshotServices(client, scope, input) : [];
      const estimatedTotal = snapshotServices.reduce((sum, service) => sum + service.estimatedTotal, 0);
      const title =
        input.title?.trim() ||
        (snapshotServices.length ? snapshotServices.map((service) => service.serviceName).join(", ") : "Custom request");
      const snapshot = {
        version: 1,
        kind: input.kind,
        countryCode: input.countryCode,
        currencyCode: input.currencyCode,
        title,
        description: input.description ?? "",
        services: snapshotServices,
      };

      const inserted = await client.query<{ id: string }>(
        `
          insert into public.client_service_requests (
            tenant_id, client_id, kind, title, description, country_code, currency_code,
            status, snapshot, estimated_total, submitted_by_user_id, idempotency_key, request_fingerprint
          )
          values ($1, $2, $3, $4, $5, $6, $7, 'submitted', $8::jsonb, $9, $10, $11, $12)
          returning id::text
        `,
        [
          scope.tenantId,
          scope.clientId,
          input.kind,
          title,
          input.description ?? "",
          input.countryCode,
          input.currencyCode,
          JSON.stringify(snapshot),
          estimatedTotal,
          scope.userId,
          input.idempotencyKey,
          fingerprint,
        ],
      ).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: "CLIENT_SERVICE_REQUEST_DUPLICATE",
            message: "A matching request is already waiting for review.",
          });
        }
        throw error;
      });
      const requestId = inserted.rows[0]?.id;
      if (!requestId) {
        throw new ConflictException({
          code: "CLIENT_SERVICE_REQUEST_CREATE_FAILED",
          message: "Request could not be created.",
        });
      }

      for (const service of snapshotServices) {
        await client.query(
          `
            insert into public.client_service_request_items (
              tenant_id, request_id, client_id, service_id, task_snapshot
            )
            values ($1, $2, $3, $4, $5::jsonb)
          `,
          [scope.tenantId, requestId, scope.clientId, service.serviceId, JSON.stringify({ tasks: service.tasks })],
        );
      }

      await client.query(
        "select audit.write_audit_event('CLIENT_SERVICE_REQUEST_RECEIVED', 'client_service_request', $1::uuid, 'succeeded', null, $2::jsonb)",
        [requestId, JSON.stringify({ clientId: scope.clientId, kind: input.kind, title })],
      );
      await this.notifyTenant(client, scope, requestId, title, input.kind);
      const created = await this.loadRequestRow(client, scope.tenantId, requestId);
      return this.mapRequest(client, scope.tenantId, created, false);
    });
  }

  async listForTenant(
    context: TenantAdminRequestContext,
    status?: ClientServiceRequestDto["status"],
  ): Promise<readonly ClientServiceRequestDto[]> {
    return this.withTenantAdmin(context, async (client) => {
      const rows = await this.listRows(client, context.tenantId, { status });
      return Promise.all(rows.map((row) => this.mapRequest(client, context.tenantId, row, false)));
    });
  }

  async getForTenant(context: TenantAdminRequestContext, requestId: string): Promise<ClientServiceRequestDto> {
    return this.withTenantAdmin(context, async (client) => {
      const row = await this.loadRequestRow(client, context.tenantId, requestId);
      return this.mapRequest(client, context.tenantId, row, false);
    });
  }

  async accept(
    context: TenantAdminRequestContext,
    requestId: string,
    input: AcceptClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.withTenantAdmin(context, async (client) => {
      const locked = await this.lockRequest(client, context.tenantId, requestId);
      if (locked.status === "accepted") {
        const mapped = await this.mapRequest(client, context.tenantId, locked, true);
        if (locked.kind !== "catalogue") return mapped;
        const activationInput = this.toActivateInput(locked, input, mapped);
        const activated = await this.activation.activateInTransaction(
          client,
          context,
          locked.client_id,
          activationInput,
        );
        return { ...mapped, activatedServices: activated.services };
      }
      if (locked.status !== "submitted") {
        throw new ConflictException({
          code: "CLIENT_SERVICE_REQUEST_NOT_SUBMITTED",
          message: "Only a submitted request can be accepted.",
        });
      }

      const mapped = await this.mapRequest(client, context.tenantId, locked, false);
      let activatedServices: ClientServiceRequestDto["activatedServices"];
      if (locked.kind === "catalogue") {
        if (mapped.services.length === 0) {
          throw new BadRequestException({
            code: "CLIENT_SERVICE_REQUEST_SERVICES_REQUIRED",
            message: "This request has no services to activate.",
          });
        }
        const assignmentByService = new Map(input.assignments.map((item) => [item.serviceId, item.assignedEmployeeId]));
        for (const service of mapped.services) {
          const assignedEmployeeId = assignmentByService.get(service.serviceId);
          if (!assignedEmployeeId) {
            throw new BadRequestException({
              code: "CLIENT_SERVICE_REQUEST_ASSIGNEE_REQUIRED",
              message: `Select who will take care of ${service.serviceName}.`,
            });
          }
          await client.query(
            `
              update public.client_service_request_items
              set assigned_employee_id = $4, updated_at = now()
              where tenant_id = $1 and request_id = $2 and service_id = $3
            `,
            [context.tenantId, requestId, service.serviceId, assignedEmployeeId],
          );
        }
        const activationInput = this.toActivateInput(locked, input, mapped);
        const activated = await this.activation.activateInTransaction(
          client,
          context,
          locked.client_id,
          activationInput,
        );
        activatedServices = activated.services;
      }

      await this.markReviewed(client, context, requestId, "accepted", input.remarks);
      await this.notifyClient(
        client,
        context,
        locked,
        "CLIENT_SERVICE_REQUEST_ACCEPTED",
        "Service request accepted",
        `${locked.title} was accepted. Scheduled work will appear in Active services.`,
      );
      await client.query(
        "select audit.write_audit_event('CLIENT_SERVICE_REQUEST_ACCEPTED', 'client_service_request', $1::uuid, 'succeeded', null, $2::jsonb)",
        [requestId, JSON.stringify({ clientId: locked.client_id, kind: locked.kind })],
      );
      const updated = await this.loadRequestRow(client, context.tenantId, requestId);
      return { ...(await this.mapRequest(client, context.tenantId, updated, false)), activatedServices };
    });
  }

  async reject(
    context: TenantAdminRequestContext,
    requestId: string,
    input: RejectClientServiceRequest,
  ): Promise<ClientServiceRequestDto> {
    return this.withTenantAdmin(context, async (client) => {
      const locked = await this.lockRequest(client, context.tenantId, requestId);
      if (locked.status === "rejected") {
        return this.mapRequest(client, context.tenantId, locked, true);
      }
      if (locked.status !== "submitted") {
        throw new ConflictException({
          code: "CLIENT_SERVICE_REQUEST_NOT_SUBMITTED",
          message: "Only a submitted request can be rejected.",
        });
      }
      await this.markReviewed(client, context, requestId, "rejected", input.remarks);
      await this.notifyClient(
        client,
        context,
        locked,
        "CLIENT_SERVICE_REQUEST_REJECTED",
        "Service request rejected",
        `${locked.title} was not accepted. ${input.remarks}`,
      );
      await client.query(
        "select audit.write_audit_event('CLIENT_SERVICE_REQUEST_REJECTED', 'client_service_request', $1::uuid, 'succeeded', null, $2::jsonb)",
        [requestId, JSON.stringify({ clientId: locked.client_id, remarks: input.remarks })],
      );
      const updated = await this.loadRequestRow(client, context.tenantId, requestId);
      return this.mapRequest(client, context.tenantId, updated, false);
    });
  }

  private async buildSnapshotServices(
    client: PoolClient,
    scope: ClientPortalScope,
    input: CreateClientServiceRequest,
  ) {
    const serviceIds = input.services.map((service) => service.serviceId);
    const active = await client.query<{ service_id: string }>(
      `
        select service_id::text
        from public.engagements
        where tenant_id = $1
          and client_id = $2
          and service_id = any($3::uuid[])
          and status in ('draft', 'active')
      `,
      [scope.tenantId, scope.clientId, serviceIds],
    );
    if (active.rowCount) {
      throw new ConflictException({
        code: "SERVICE_ALREADY_ACTIVE",
        message: "One or more selected services are already active for this client.",
      });
    }
    const pending = await client.query<{ service_id: string; service_name: string }>(
      `
        select csri.service_id::text, s.name as service_name
        from public.client_service_request_items csri
        join public.client_service_requests csr
          on csr.tenant_id = csri.tenant_id and csr.id = csri.request_id
        join public.services s
          on s.tenant_id = csri.tenant_id and s.id = csri.service_id
        where csr.tenant_id = $1
          and csr.client_id = $2
          and csr.status = 'submitted'
          and csri.service_id = any($3::uuid[])
      `,
      [scope.tenantId, scope.clientId, serviceIds],
    );
    if (pending.rows[0]) {
      throw new ConflictException({
        code: "SERVICE_ALREADY_REQUESTED",
        message: `${pending.rows[0].service_name} already has a request waiting for tenant review.`,
      });
    }

    const snapshotServices = [];
    for (const selected of input.services) {
      const enabledTasks = selected.tasks.filter((task) => task.enabled !== false);
      if (!enabledTasks.length) {
        throw new BadRequestException({
          code: "SERVICE_TASKS_REQUIRED",
          message: "Keep at least one task in each selected service.",
        });
      }
      const service = await client.query<{ id: string; name: string; code: string }>(
        "select id::text, name, code from public.services where tenant_id = $1 and id = $2 and status = 'active'",
        [scope.tenantId, selected.serviceId],
      );
      const row = service.rows[0];
      if (!row) {
        throw new BadRequestException({
          code: "SERVICE_NOT_AVAILABLE",
          message: "Select an active tenant service.",
        });
      }
      snapshotServices.push({
        serviceId: row.id,
        serviceName: row.name,
        code: row.code,
        estimatedTotal: enabledTasks.reduce(
          (sum, task) => sum + task.rateAmount * yearlyOccurrenceCount(task.frequency),
          0,
        ),
        tasks: enabledTasks,
      });
    }
    return snapshotServices;
  }

  private toActivateInput(
    request: RequestRow,
    input: AcceptClientServiceRequest,
    mapped: ClientServiceRequestDto,
  ): ActivateClientServicesRequest {
    const assignmentByService = new Map(input.assignments.map((item) => [item.serviceId, item.assignedEmployeeId]));
    for (const service of mapped.services) {
      if (!assignmentByService.has(service.serviceId) && service.assignedEmployeeId) {
        assignmentByService.set(service.serviceId, service.assignedEmployeeId);
      }
    }
    return {
      idempotencyKey: request.id,
      countryCode: request.country_code,
      currencyCode: request.currency_code as ActivateClientServicesRequest["currencyCode"],
      discountPercent: input.discountPercent,
      services: mapped.services.map((service) => {
        const assignedEmployeeId = assignmentByService.get(service.serviceId);
        if (!assignedEmployeeId) {
          throw new BadRequestException({
            code: "CLIENT_SERVICE_REQUEST_ASSIGNEE_REQUIRED",
            message: `Select who will take care of ${service.serviceName}.`,
          });
        }
        return {
          serviceId: service.serviceId,
          assignedEmployeeId,
          tasks: service.tasks.map((task) => ({
            taskType: task.taskType,
            title: task.title,
            frequency: task.frequency as ActivateClientServicesRequest["services"][number]["tasks"][number]["frequency"],
            dueRule: task.dueRule,
            unitType: task.unitType as ActivateClientServicesRequest["services"][number]["tasks"][number]["unitType"],
            rateAmount: task.rateAmount,
            taxCode: task.taxCode ?? "",
            enabled: task.enabled !== false,
          })),
        };
      }),
    };
  }

  private async listRows(
    client: PoolClient,
    tenantId: string,
    filters: { clientId?: string; status?: ClientServiceRequestDto["status"] },
  ): Promise<readonly RequestRow[]> {
    const result = await client.query<RequestRow>(
      `
        select
          csr.id::text,
          csr.kind,
          csr.title,
          csr.description,
          csr.status,
          csr.client_id::text,
          c.display_name as client_name,
          csr.country_code,
          csr.currency_code,
          csr.estimated_total::text,
          csr.review_remarks,
          csr.submitted_at,
          csr.updated_at,
          csr.reviewed_at,
          csr.snapshot
        from public.client_service_requests csr
        join public.clients c
          on c.tenant_id = csr.tenant_id and c.id = csr.client_id
        where csr.tenant_id = $1
          and ($2::uuid is null or csr.client_id = $2::uuid)
          and ($3::text is null or csr.status = $3)
        order by csr.submitted_at desc, csr.id desc
        limit 100
      `,
      [tenantId, filters.clientId ?? null, filters.status ?? null],
    );
    return result.rows;
  }

  private async loadByIdempotency(
    client: PoolClient,
    tenantId: string,
    clientId: string,
    idempotencyKey: string,
  ): Promise<(RequestRow & { request_fingerprint: string }) | null> {
    const result = await client.query<RequestRow & { request_fingerprint: string }>(
      `
        select
          csr.id::text,
          csr.kind,
          csr.title,
          csr.description,
          csr.status,
          csr.client_id::text,
          c.display_name as client_name,
          csr.country_code,
          csr.currency_code,
          csr.estimated_total::text,
          csr.review_remarks,
          csr.submitted_at,
          csr.updated_at,
          csr.reviewed_at,
          csr.snapshot,
          csr.request_fingerprint
        from public.client_service_requests csr
        join public.clients c
          on c.tenant_id = csr.tenant_id and c.id = csr.client_id
        where csr.tenant_id = $1
          and csr.client_id = $2
          and csr.idempotency_key = $3
      `,
      [tenantId, clientId, idempotencyKey],
    );
    return result.rows[0] ?? null;
  }

  private async loadRequestRow(client: PoolClient, tenantId: string, requestId: string): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `
        select
          csr.id::text,
          csr.kind,
          csr.title,
          csr.description,
          csr.status,
          csr.client_id::text,
          c.display_name as client_name,
          csr.country_code,
          csr.currency_code,
          csr.estimated_total::text,
          csr.review_remarks,
          csr.submitted_at,
          csr.updated_at,
          csr.reviewed_at,
          csr.snapshot
        from public.client_service_requests csr
        join public.clients c
          on c.tenant_id = csr.tenant_id and c.id = csr.client_id
        where csr.tenant_id = $1
          and csr.id = $2
      `,
      [tenantId, requestId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({ code: "CLIENT_SERVICE_REQUEST_NOT_FOUND", message: "Request could not be loaded." });
    }
    return row;
  }

  private async lockRequest(client: PoolClient, tenantId: string, requestId: string): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `
        select
          csr.id::text,
          csr.kind,
          csr.title,
          csr.description,
          csr.status,
          csr.client_id::text,
          c.display_name as client_name,
          csr.country_code,
          csr.currency_code,
          csr.estimated_total::text,
          csr.review_remarks,
          csr.submitted_at,
          csr.updated_at,
          csr.reviewed_at,
          csr.snapshot
        from public.client_service_requests csr
        join public.clients c
          on c.tenant_id = csr.tenant_id and c.id = csr.client_id
        where csr.tenant_id = $1
          and csr.id = $2
        for update of csr
      `,
      [tenantId, requestId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({ code: "CLIENT_SERVICE_REQUEST_NOT_FOUND", message: "Request could not be loaded." });
    }
    return row;
  }

  private async mapRequest(
    client: PoolClient,
    tenantId: string,
    row: RequestRow,
    replayed: boolean,
  ): Promise<ClientServiceRequestDto> {
    const items = await client.query<ItemRow>(
      `
        select
          csri.service_id::text,
          s.name as service_name,
          csri.assigned_employee_id::text,
          csri.task_snapshot
        from public.client_service_request_items csri
        join public.services s
          on s.tenant_id = csri.tenant_id and s.id = csri.service_id
        where csri.tenant_id = $1
          and csri.request_id = $2
        order by lower(s.name)
      `,
      [tenantId, row.id],
    );
    const snapshotServices = snapshotServiceList(row.snapshot);
    const services = items.rows.length
      ? items.rows.map((item) => {
          const snapshot = snapshotServices.find((service) => service.serviceId === item.service_id);
          const tasks = parseTasks(item.task_snapshot) ?? snapshot?.tasks ?? [];
          return {
            serviceId: item.service_id,
            serviceName: item.service_name,
            assignedEmployeeId: item.assigned_employee_id,
            estimatedTotal:
              snapshot?.estimatedTotal ??
              tasks.reduce((sum, task) => sum + task.rateAmount * occurrenceCount(task.frequency), 0),
            tasks,
          };
        })
      : snapshotServices;
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      status: row.status,
      clientId: row.client_id,
      clientName: row.client_name,
      countryCode: row.country_code,
      currencyCode: row.currency_code,
      estimatedTotal: Number(row.estimated_total),
      reviewRemarks: row.review_remarks,
      replayed,
      submittedAt: row.submitted_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      services,
    };
  }

  private async markReviewed(
    client: PoolClient,
    context: TenantAdminRequestContext,
    requestId: string,
    status: "accepted" | "rejected",
    remarks?: string,
  ): Promise<void> {
    await client.query(
      `
        update public.client_service_requests
        set status = $3,
            reviewed_by_user_id = $4,
            reviewed_at = now(),
            review_remarks = $5,
            updated_at = now()
        where tenant_id = $1
          and id = $2
      `,
      [context.tenantId, requestId, status, context.userId, remarks ?? null],
    );
  }

  private async notifyTenant(
    client: PoolClient,
    context: ClientPortalScope,
    requestId: string,
    title: string,
    kind: string,
  ): Promise<void> {
    await client.query(
      `
        with request_client as (
          select display_name
          from public.clients
          where tenant_id = $1 and id = $2
        ),
        inserted as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
          )
          select
            'CLIENT_REQUEST_RECEIVED',
            'Client service request',
            coalesce(request_client.display_name, 'Client') || ' requested "' || $4 || '".',
            'INFO',
            $1,
            $5,
            'client_service_request',
            $3::uuid,
            '/admin/tasks',
            jsonb_build_object('clientId', $2, 'requestId', $3::uuid, 'kind', $6),
            'client-service-request-received:' || $3::uuid::text
          from request_client
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select inserted.id, tm.user_id
        from inserted
        join public.tenant_memberships tm
          on tm.tenant_id = $1 and tm.status = 'active'
        join public.membership_roles mr
          on mr.tenant_id = tm.tenant_id and mr.membership_id = tm.id and mr.status = 'active'
        join public.roles r
          on r.id = mr.role_id and r.code = 'TENANT_ADMIN'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, context.clientId, requestId, title, context.userId, kind],
    );
  }

  private async notifyClient(
    client: PoolClient,
    context: TenantAdminRequestContext,
    request: RequestRow,
    type: "CLIENT_SERVICE_REQUEST_ACCEPTED" | "CLIENT_SERVICE_REQUEST_REJECTED",
    title: string,
    message: string,
  ): Promise<void> {
    await client.query(
      `
        with inserted as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
          )
          values (
            $4, $5, $6, 'INFO', $1, $3, 'client_service_request', $2::uuid, '/client/requests',
            jsonb_build_object('requestId', $2::uuid, 'clientId', $7::uuid),
            $8
          )
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        ),
        notification_row as (
          select id from inserted
          union all
          select id from public.notifications where idempotency_key = $8
          limit 1
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select notification_row.id, cpa.user_id
        from notification_row
        join public.client_portal_accounts cpa
          on cpa.tenant_id = $1 and cpa.client_id = $7::uuid and cpa.status = 'active'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [
        context.tenantId,
        request.id,
        context.userId,
        type,
        title,
        message,
        request.client_id,
        `${type.toLowerCase().replaceAll("_", "-")}:${request.id}`,
      ],
    );
  }

  private async withClientPortal<T>(
    context: ClientPortalRequestContext,
    work: (client: PoolClient, scope: ClientPortalScope) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const scope = await resolveClientPortalScope(client, context);
      return work(client, scope);
    });
  }

  private async withTenantAdmin<T>(
    context: TenantAdminRequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: string }).code === "23505");
}

function occurrenceCount(frequency: string): number {
  if (
    frequency === "monthly" ||
    frequency === "quarterly" ||
    frequency === "annually" ||
    frequency === "one_time"
  ) {
    return yearlyOccurrenceCount(frequency satisfies ServiceBlueprintFrequency);
  }
  return 1;
}

function requestFingerprint(clientId: string, input: CreateClientServiceRequest): string {
  const canonical = {
    clientId,
    kind: input.kind,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    title: input.title ?? "",
    description: input.description ?? "",
    services: [...input.services]
      .map((service) => ({
        serviceId: service.serviceId,
        tasks: [...service.tasks]
          .filter((task) => task.enabled !== false)
          .map((task) => ({
            taskType: task.taskType,
            title: task.title ?? "",
            frequency: task.frequency,
            dueRule: task.dueRule,
            rateAmount: task.rateAmount,
            unitType: task.unitType,
          }))
          .sort((left, right) => left.taskType.localeCompare(right.taskType)),
      }))
      .sort((left, right) => left.serviceId.localeCompare(right.serviceId)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function snapshotServiceList(snapshot: unknown): ClientServiceRequestDto["services"] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const services = (snapshot as { services?: unknown }).services;
  if (!Array.isArray(services)) return [];
  return services.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const serviceId = typeof record.serviceId === "string" ? record.serviceId : "";
    const serviceName = typeof record.serviceName === "string" ? record.serviceName : "";
    if (!serviceId || !serviceName) return [];
    return [
      {
        serviceId,
        serviceName,
        assignedEmployeeId: typeof record.assignedEmployeeId === "string" ? record.assignedEmployeeId : null,
        estimatedTotal: typeof record.estimatedTotal === "number" ? record.estimatedTotal : 0,
        tasks: parseTasks(record.tasks) ?? [],
      },
    ];
  });
}

function parseTasks(value: unknown): ClientServiceRequestDto["services"][number]["tasks"] | null {
  const source = value && typeof value === "object" && "tasks" in value ? (value as { tasks: unknown }).tasks : value;
  if (!Array.isArray(source)) return null;
  return source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const taskType = typeof record.taskType === "string" ? record.taskType : "";
    const frequency = typeof record.frequency === "string" ? record.frequency : "";
    const unitType = typeof record.unitType === "string" ? record.unitType : "";
    const rateAmount = typeof record.rateAmount === "number" ? record.rateAmount : Number(record.rateAmount);
    if (!taskType || !frequency || !unitType || Number.isNaN(rateAmount)) return [];
    const dueRule = record.dueRule && typeof record.dueRule === "object" ? (record.dueRule as { type?: string }) : null;
    if (!dueRule?.type) return [];
    return [
      {
        taskType,
        title: typeof record.title === "string" ? record.title : undefined,
        frequency,
        dueRule: dueRule as ClientServiceRequestDto["services"][number]["tasks"][number]["dueRule"],
        unitType,
        rateAmount,
        taxCode: typeof record.taxCode === "string" ? record.taxCode : "",
        enabled: record.enabled !== false,
      },
    ];
  });
}
