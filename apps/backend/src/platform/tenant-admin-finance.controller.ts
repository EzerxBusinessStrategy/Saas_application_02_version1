import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  createTenantDocumentSchema,
  createTenantInvoiceSchema,
  createTaskInvoiceSchema,
  CreateTenantDocumentRequest,
  CreateTenantInvoiceRequest,
  CreateTaskInvoiceRequest,
  TenantBillableTaskEntriesResponseDto,
  listTenantFinanceQuerySchema,
  ListTenantFinanceQuery,
  TenantDocumentDto,
  TenantDocumentsResponseDto,
  TenantInvoiceDto,
  TenantInvoicesResponseDto,
} from "./tenant-admin-finance.dto";
import { TenantAdminFinanceService } from "./tenant-admin-finance.service";

@ApiTags("Tenant Admin")
@ApiBearerAuth()
@Controller("tenant-admin/finance")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
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
