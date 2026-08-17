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
import { TenantDocumentStorageService } from "./tenant-document-storage.service";

@Injectable()
export class TenantAdminFinanceService {
  constructor(
    @Inject(TenantAdminFinanceRepository) private readonly repository: TenantAdminFinanceRepository,
    @Inject(TenantDocumentStorageService) private readonly storage: TenantDocumentStorageService,
  ) {}

  async listDocuments(context: RequestContext, clientId?: string): Promise<TenantDocumentsResponseDto> {
    return { documents: await this.repository.listDocuments(requireTenantAdminContext(context), clientId) };
  }

  async createDocument(context: RequestContext, input: CreateTenantDocumentRequest): Promise<TenantDocumentDto> {
    const scoped = requireTenantAdminContext(context);
    const object = await this.storage.verifyUploadedFile({ tenantId: scoped.tenantId, clientId: input.clientId, portal: "TENANT", storageKey: input.storageKey, fileName: input.fileName, contentType: input.contentType, sizeBytes: input.sizeBytes });
    return this.repository.createDocument(scoped, input, object.storageBucket);
  }

  async createDocumentUploadUrl(context: RequestContext, input: { clientId?: string; fileName: string; contentType: string; sizeBytes: number; idempotencyKey?: string }) {
    const scoped = requireTenantAdminContext(context);
    return this.storage.createSignedUploadUrl({ tenantId: scoped.tenantId, portal: "TENANT", ...input, operationId: input.idempotencyKey });
  }

  async createDocumentDownloadUrl(context: RequestContext, documentId: string): Promise<{ url: string }> {
    const scoped = requireTenantAdminContext(context);
    return { url: await this.storage.createSignedDownloadUrl(await this.repository.getDocumentStorageObject(scoped, documentId)) };
  }

  async listInvoices(context: RequestContext, clientId?: string): Promise<TenantInvoicesResponseDto> {
    return { invoices: await this.repository.listInvoices(requireTenantAdminContext(context), clientId) };
  }

  async createInvoice(context: RequestContext, input: CreateTenantInvoiceRequest): Promise<TenantInvoiceDto> {
    const scoped = requireTenantAdminContext(context);
    const object = await this.storage.verifyUploadedFile({ tenantId: scoped.tenantId, clientId: input.clientId, portal: "TENANT", storageKey: input.storageKey, fileName: input.fileName, contentType: input.contentType, sizeBytes: input.sizeBytes });
    return this.repository.createInvoice(scoped, input, object.storageBucket);
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
