import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import { ClientPortalDashboardResponseDto } from "./client-portal-dashboard.dto";
import { ClientPortalDashboardRepository } from "./client-portal-dashboard.repository";

@Injectable()
export class ClientPortalDashboardService {
  constructor(
    @Inject(ClientPortalDashboardRepository)
    private readonly repository: ClientPortalDashboardRepository,
  ) {}

  async read(context: RequestContext): Promise<ClientPortalDashboardResponseDto> {
    const scoped = requireClientPortalContext(context);
    const data = await this.repository.read(scoped);
    return {
      activeServices: Number(data.summary.active_services),
      openRequests: Number(data.summary.open_requests),
      outstandingInvoices: Number(data.summary.outstanding_invoices),
      currencyCode: data.summary.currency_code,
      services: data.services.map((service) => ({
        id: service.id,
        engagementName: service.engagement_name,
        serviceName: service.service_name,
        status: service.status,
        nextDueAt: service.next_due_at?.toISOString() ?? null,
        openTasks: Number(service.open_tasks),
        completedTasks: Number(service.completed_tasks),
        totalTasks: Number(service.total_tasks),
      })),
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
