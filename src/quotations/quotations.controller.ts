import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QuotationsService } from './quotations.service';
import {
  ActionNoteDto,
  CreateQuotationDto,
  SendToInsuranceDto,
  UpdateQuotationDto,
  actionNoteSchema,
  createQuotationSchema,
  sendToInsuranceSchema,
  updateQuotationSchema,
} from './quotations.validation';

@ApiTags('Quotations')
@Controller('quotations')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List all quotations' })
  list() {
    return this.quotationsService.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get quotation by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.quotationsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'create')
  @UsePipes(new ZodValidationPipe(createQuotationSchema))
  @ApiOperation({ summary: 'Create a new quotation' })
  create(@Body() body: CreateQuotationDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateQuotationSchema))
  @ApiOperation({ summary: 'Update a quotation (DRAFT or REVISION only)' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateQuotationDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Soft delete a quotation (DRAFT only)' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.delete(id, actor);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'submit')
  @UsePipes(new ZodValidationPipe(actionNoteSchema))
  @ApiOperation({
    summary: 'Submit quotation for approval (DRAFT → WAITING_APPROVAL)',
  })
  @ApiParam({ name: 'id', type: String })
  submit(
    @Param('id') id: string,
    @Body() body: ActionNoteDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.submit(id, actor, body);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'approve')
  @UsePipes(new ZodValidationPipe(actionNoteSchema))
  @ApiOperation({ summary: 'Approve quotation (WAITING_APPROVAL → APPROVED)' })
  @ApiParam({ name: 'id', type: String })
  approve(
    @Param('id') id: string,
    @Body() body: ActionNoteDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.approve(id, actor, body);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'approve')
  @UsePipes(new ZodValidationPipe(actionNoteSchema))
  @ApiOperation({ summary: 'Reject quotation (WAITING_APPROVAL → DRAFT)' })
  @ApiParam({ name: 'id', type: String })
  reject(
    @Param('id') id: string,
    @Body() body: ActionNoteDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.reject(id, actor, body);
  }

  @Post(':id/request-revision')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'approve')
  @UsePipes(new ZodValidationPipe(actionNoteSchema))
  @ApiOperation({
    summary: 'Request quotation revision (WAITING_APPROVAL → DRAFT)',
  })
  @ApiParam({ name: 'id', type: String })
  requestRevision(
    @Param('id') id: string,
    @Body() body: ActionNoteDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.requestRevision(id, actor, body);
  }

  @Post(':id/send-to-insurance')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'send-to-insurance')
  @UsePipes(new ZodValidationPipe(sendToInsuranceSchema))
  @ApiOperation({ summary: 'Send approved quotation to an insurance company' })
  @ApiParam({ name: 'id', type: String })
  sendToInsurance(
    @Param('id') id: string,
    @Body() body: SendToInsuranceDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.sendToInsurance(id, actor, body);
  }

  @Post(':id/insurance-approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'record-insurer-review')
  @UsePipes(new ZodValidationPipe(actionNoteSchema))
  @ApiOperation({
    summary: 'Record insurer approval (SENT_TO_INSURANCE → INSURANCE_APPROVED)',
  })
  @ApiParam({ name: 'id', type: String })
  insuranceApprove(
    @Param('id') id: string,
    @Body() body: ActionNoteDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.insuranceApprove(id, actor, body);
  }

  @Post(':id/insurance-revision')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'record-insurer-review')
  @UsePipes(new ZodValidationPipe(actionNoteSchema))
  @ApiOperation({
    summary: 'Insurance requests revision (SENT_TO_INSURANCE → REVISION)',
  })
  @ApiParam({ name: 'id', type: String })
  insuranceRevision(
    @Param('id') id: string,
    @Body() body: ActionNoteDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.quotationsService.insuranceRevision(id, actor, body);
  }

  @Get(':id/approvals')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get quotation approval history' })
  @ApiParam({ name: 'id', type: String })
  getApprovals(@Param('id') id: string) {
    return this.quotationsService.getApprovals(id);
  }

  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get quotation status change history' })
  @ApiParam({ name: 'id', type: String })
  getHistory(@Param('id') id: string) {
    return this.quotationsService.getHistory(id);
  }

  @Get(':id/export-pdf')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'export')
  @ApiOperation({
    summary: 'Export an approved quotation as PDF (placeholder)',
  })
  @ApiParam({ name: 'id', type: String })
  exportPdf(@Param('id') id: string, @Req() req: Request) {
    return this.quotationsService.exportPdf(id, req.credentials.sub);
  }
}
