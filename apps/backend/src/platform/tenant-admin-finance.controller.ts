import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PortalSessionGuard } from "../auth/guards/portal-session.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  createTenantDocumentSchema,
  createTenantDocumentUploadUrlSchema,
  createTenantInvoiceSchema,
  CreateTenantDocumentUploadUrlRequest,
  createTaskInvoiceSchema,
  createEntriesInvoiceSchema,
  CreateTenantDocumentRequest,
  CreateTenantInvoiceRequest,
  CreateTaskInvoiceRequest,
  CreateEntriesInvoiceRequest,
  TenantBillableTaskEntriesResponseDto,
  TenantBillingGroupsResponseDto,
  listTenantFinanceQuerySchema,
  ListTenantFinanceQuery,
  TenantDocumentDto,
  TenantDocumentsResponseDto,
  TenantInvoiceDto,
  TenantInvoicesResponseDto,
  DocumentDownloadUrlDto,
  DocumentUploadUrlDto,
} from "./tenant-admin-finance.dto";
import { TenantAdminFinanceService } from "./tenant-admin-finance.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/finance")
@UseGuards(PortalSessionGuard, ActiveRequestContextGuard, PermissionGuard)
export class TenantAdminFinanceController {
  constructor(@Inject(TenantAdminFinanceService) private readonly service: TenantAdminFinanceService) {}

  @Get("documents")
  @RequirePermissions("document.read")
  @ApiOperation({ summary: "Return tenant-scoped document metadata." })
  @ApiOkResponse({ type: TenantDocumentsResponseDto })
  listDocuments(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(listTenantFinanceQuerySchema)) query: ListTenantFinanceQuery,
  ): Promise<TenantDocumentsResponseDto> {
    return this.service.listDocuments(context, query.clientId);
  }

  @Post("documents")
  @RequirePermissions("document.publish")
  @ApiOperation({ summary: "Create tenant-scoped document metadata." })
  @ApiOkResponse({ type: TenantDocumentDto })
  createDocument(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantDocumentSchema)) body: CreateTenantDocumentRequest,
  ): Promise<TenantDocumentDto> {
    return this.service.createDocument(context, body);
  }

  @Post("documents/upload-url")
  @RequirePermissions("document.publish")
  @ApiOperation({ summary: "Authorize a private document upload for the tenant." })
  @ApiOkResponse({ type: DocumentUploadUrlDto })
  createDocumentUploadUrl(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantDocumentUploadUrlSchema)) body: CreateTenantDocumentUploadUrlRequest,
  ): Promise<DocumentUploadUrlDto> {
    return this.service.createDocumentUploadUrl(context, body);
  }

  @Get("documents/:documentId/download")
  @RequirePermissions("document.read")
  @ApiOperation({ summary: "Authorize a private document download." })
  @ApiOkResponse({ type: DocumentDownloadUrlDto })
  createDocumentDownloadUrl(
    @CurrentRequestContext() context: RequestContext,
    @Param("documentId") documentId: string,
  ): Promise<DocumentDownloadUrlDto> {
    return this.service.createDocumentDownloadUrl(context, documentId);
  }

  @Get("invoices")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Return tenant-scoped invoices." })
  @ApiOkResponse({ type: TenantInvoicesResponseDto })
  listInvoices(
    @CurrentRequestContext() context: RequestContext,
    @Query(new ZodValidationPipe(listTenantFinanceQuerySchema)) query: ListTenantFinanceQuery,
  ): Promise<TenantInvoicesResponseDto> {
    return this.service.listInvoices(context, query.clientId);
  }

  @Post("invoices")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Create a tenant-scoped invoice." })
  @ApiOkResponse({ type: TenantInvoiceDto })
  createInvoice(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTenantInvoiceSchema)) body: CreateTenantInvoiceRequest,
  ): Promise<TenantInvoiceDto> {
    return this.service.createInvoice(context, body);
  }

  @Get("billable-tasks")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Return tenant-scoped task charges ready to invoice." })
  @ApiOkResponse({ type: TenantBillableTaskEntriesResponseDto })
  listBillableTasks(@CurrentRequestContext() context: RequestContext): Promise<TenantBillableTaskEntriesResponseDto> {
    return this.service.listBillableTaskEntries(context);
  }

  @Get("billing-groups")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Return tenant-scoped billing groups with approved charges." })
  @ApiOkResponse({ type: TenantBillingGroupsResponseDto })
  listBillingGroups(@CurrentRequestContext() context: RequestContext): Promise<TenantBillingGroupsResponseDto> {
    return this.service.listBillingGroups(context);
  }

  @Post("invoices/from-task")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Create a draft invoice from one tenant-scoped task charge." })
  @ApiOkResponse({ type: TenantInvoiceDto })
  createInvoiceFromTask(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createTaskInvoiceSchema)) body: CreateTaskInvoiceRequest,
  ): Promise<TenantInvoiceDto> {
    return this.service.createInvoiceFromTask(context, body);
  }

  @Post("invoices/from-entries")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Create one draft invoice from a complete billing group of approved charges." })
  @ApiOkResponse({ type: TenantInvoiceDto })
  createInvoiceFromEntries(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createEntriesInvoiceSchema)) body: CreateEntriesInvoiceRequest,
  ): Promise<TenantInvoiceDto> {
    return this.service.createInvoiceFromEntries(context, body);
  }

  @Post("invoices/:invoiceId/send")
  @RequirePermissions("invoice.create")
  @ApiOperation({ summary: "Send a draft invoice to its client portal." })
  @ApiOkResponse({ type: TenantInvoiceDto })
  sendInvoice(
    @CurrentRequestContext() context: RequestContext,
    @Param("invoiceId") invoiceId: string,
  ): Promise<TenantInvoiceDto> {
    return this.service.sendInvoice(context, invoiceId);
  }
}
