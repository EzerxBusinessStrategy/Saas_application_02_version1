import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import {
  ClientPortalDashboardQuery,
  ClientPortalDashboardResponseDto,
  ClientPortalDashboardServiceTaskDto,
} from "./client-portal-dashboard.dto";
import { ClientPortalDashboardRepository } from "./client-portal-dashboard.repository";
import { summarizeClientServicePricing } from "./client-service-pricing";
import { resolveClientDashboardPeriod, utcTodayIso } from "./tenant-admin-dashboard.period";

@Injectable()
export class ClientPortalDashboardService {
  constructor(
    @Inject(ClientPortalDashboardRepository)
    private readonly repository: ClientPortalDashboardRepository,
  ) {}

  async read(
    context: RequestContext,
    query: ClientPortalDashboardQuery = {},
  ): Promise<ClientPortalDashboardResponseDto> {
    const scoped = requireClientPortalContext(context);
    const period = resolveClientDashboardPeriod({
      from: query.from,
      to: query.to,
      today: utcTodayIso(),
    });
    const data = await this.repository.read(scoped, period);
    const periodSource = period.source === "financial_year" ? "upcoming_year" : period.source;
    return {
      period: {
        from: period.from,
        to: period.to,
        source: periodSource,
      },
      activeServices: Number(data.summary.active_services),
      pendingTasks: Number(data.summary.pending_tasks),
      completedTasks: Number(data.summary.completed_tasks),
      openRequests: Number(data.summary.open_requests),
      outstandingInvoices: Number(data.summary.outstanding_invoices),
      currencyCode: data.summary.currency_code,
      services: data.services.map((service) => {
        const completedTasks = Number(service.completed_tasks);
        const totalTasks = Number(service.total_tasks);
        const tasks = parseServiceTasks(service.tasks);
        const pricing = summarizeClientServicePricing(
          tasks,
          toFiniteNumber(service.discount_percent) ?? 0,
        );
        return {
          id: service.id,
          engagementName: service.engagement_name,
          serviceName: service.service_name,
          status: service.status,
          nextDueAt: service.next_due_at?.toISOString() ?? null,
          openTasks: Number(service.open_tasks),
          completedTasks,
          totalTasks,
          progressPercent: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
          assignedEmployeeName: service.assigned_employee_name,
          estimatedTotal: service.estimated_total == null ? null : Number(service.estimated_total),
          taskTotal: pricing.taskTotal,
          discountAmount: pricing.discountAmount,
          discountPercent: pricing.discountPercent,
          amountDue: pricing.amountDue,
          totalDue: pricing.amountDue,
          currencyCode: service.currency_code,
          tasks,
        };
      }),
      requests: data.requests.map((request) => ({
        id: request.id,
        title: request.title,
        status: request.status,
        serviceName: request.service_name,
        countryCode: request.country_code,
        requestedDueDate: request.requested_due_date,
        submittedAt: request.submitted_at.toISOString(),
        updatedAt: request.updated_at.toISOString(),
      })),
      invoices: data.invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        taskTitle: invoice.task_title,
        status: invoice.status,
        issuedOn: invoice.issued_on,
        dueOn: invoice.due_on,
        currencyCode: invoice.currency_code,
        totalAmount: Number(invoice.total_amount),
        paidAmount: Number(invoice.paid_amount),
        outstandingAmount: Number(invoice.outstanding_amount),
      })),
    };
  }
}

function parseServiceTasks(value: unknown): ClientPortalDashboardServiceTaskDto[] {
  const rows = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const title = typeof record.title === "string" ? record.title : "";
    const status = typeof record.status === "string" ? record.status : "";
    if (!id || !title) return [];
    const currencyCode =
      typeof record.currencyCode === "string" && /^[A-Z]{3}$/.test(record.currencyCode)
        ? record.currencyCode
        : "INR";
    return [
      {
        id,
        title,
        status,
        plannedDueAt: toIsoDateTime(record.plannedDueAt),
        rateAmount: toFiniteNumber(record.rateAmount) ?? 0,
        currencyCode,
      },
    ];
  });
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function toIsoDateTime(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}
