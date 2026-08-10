import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ActiveRequestContextGuard } from "../auth/guards/active-request-context.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { RequirePermissions } from "../auth/permissions.decorator";
import { CurrentRequestContext } from "../auth/request-context.decorator";
import { RequestContext } from "../auth/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import {
  createEmployeeDocumentSchema,
  CreateEmployeeDocumentRequest,
  EmployeeDocumentDto,
  EmployeeDocumentOptionsDto,
  EmployeeDocumentsResponseDto,
} from "./employee-documents.dto";
import { EmployeeDocumentsService } from "./employee-documents.service";

@ApiTags("Employee")
@ApiBearerAuth()
@Controller("employee/documents")
@UseGuards(SupabaseAuthGuard, ActiveRequestContextGuard, PermissionGuard)
export class EmployeeDocumentsController {
  constructor(@Inject(EmployeeDocumentsService) private readonly service: EmployeeDocumentsService) {}

  @Get("options")
  @RequirePermissions("document.read")
  @ApiOperation({ summary: "Return employee document upload clients and recipients." })
  @ApiOkResponse({ type: EmployeeDocumentOptionsDto })
  options(@CurrentRequestContext() context: RequestContext): Promise<EmployeeDocumentOptionsDto> {
    return this.service.options(context);
  }

  @Get()
  @RequirePermissions("document.read")
  @ApiOperation({ summary: "Return employee-visible document metadata." })
  @ApiOkResponse({ type: EmployeeDocumentsResponseDto })
  list(@CurrentRequestContext() context: RequestContext): Promise<EmployeeDocumentsResponseDto> {
    return this.service.list(context);
  }

  @Post()
  @RequirePermissions("document.read")
  @ApiOperation({ summary: "Create employee document metadata and selected recipient access." })
  @ApiOkResponse({ type: EmployeeDocumentDto })
  create(
    @CurrentRequestContext() context: RequestContext,
    @Body(new ZodValidationPipe(createEmployeeDocumentSchema)) body: CreateEmployeeDocumentRequest,
  ): Promise<EmployeeDocumentDto> {
    return this.service.create(context, body);
  }
}
