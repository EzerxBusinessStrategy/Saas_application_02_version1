import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireTenantAdminContext } from "./tenant-admin-context";
import {
  CreateTenantDocumentRequest,
  CreateTenantInvoiceRequest,
  CreateTaskInvoiceRequest,
  TenantBillableTaskEntriesResponseDto,
  TenantDocumentsResponseDto,
  TenantDocumentDto,
  TenantInvoicesResponseDto,
  TenantInvoiceDto,
} from "./tenant-admin-finance.dto";
import { TenantAdminFinanceRepository } from "./tenant-admin-finance.repository";

@Injectable()
export class TenantAdminFinanceService {
  constructor(@Inject(TenantAdminFinanceRepository) private readonly repository: TenantAdminFinanceRepository) {}

  async listDocuments(context: RequestContext, clientId?: string): Promise<TenantDocumentsResponseDto> {
    return { documents: await this.repository.listDocuments(requireTenantAdminContext(context), clientId) };
  }

  async createDocument(context: RequestContext, input: CreateTenantDocumentRequest): Promise<TenantDocumentDto> {
    return this.repository.createDocument(requireTenantAdminContext(context), input);
  }

  async listInvoices(context: RequestContext, clientId?: string): Promise<TenantInvoicesResponseDto> {
    return { invoices: await this.repository.listInvoices(requireTenantAdminContext(context), clientId) };
  }

  async createInvoice(context: RequestContext, input: CreateTenantInvoiceRequest): Promise<TenantInvoiceDto> {
    return this.repository.createInvoice(requireTenantAdminContext(context), input);
  }

  async listBillableTaskEntries(context: RequestContext): Promise<TenantBillableTaskEntriesResponseDto> {
    return { entries: await this.repository.listBillableTaskEntries(requireTenantAdminContext(context)) };
  }

  async createInvoiceFromTask(context: RequestContext, input: CreateTaskInvoiceRequest): Promise<TenantInvoiceDto> {
    return this.repository.createInvoiceFromTask(requireTenantAdminContext(context), input);
  }

  async sendInvoice(context: RequestContext, invoiceId: string): Promise<TenantInvoiceDto> {
    return this.repository.sendInvoice(requireTenantAdminContext(context), invoiceId);
  }
}
