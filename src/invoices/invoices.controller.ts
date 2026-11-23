import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  createInvoiceSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
} from './invoices.validation';

@ApiTags('Invoices')
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('request-invoices/:requestInvoiceId/invoice-draft')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'create')
  @ApiOperation({
    summary:
      'Prefilled invoice form for a READY_FOR_INVOICE request (not saved)',
  })
  @ApiParam({ name: 'requestInvoiceId', type: String })
  draft(@Param('requestInvoiceId') requestInvoiceId: string) {
    return this.invoicesService.draft(requestInvoiceId);
  }

  @Post('invoices/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'create')
  @ApiOperation({
    summary:
      'Compute totals and amount in words for an invoice body (no write)',
  })
  preview(
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceDto,
  ) {
    return this.invoicesService.preview(body);
  }

  @Post('request-invoices/:requestInvoiceId/invoices')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('invoice', 'create')
  @ApiOperation({
    summary: 'Issue the invoice of a READY_FOR_INVOICE request (status UNPAID)',
  })
  @ApiParam({ name: 'requestInvoiceId', type: String })
  create(
    @Param('requestInvoiceId') requestInvoiceId: string,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceDto,
    @Req() req: Request,
  ) {
    return this.invoicesService.create(requestInvoiceId, body, this.actor(req));
  }

  @Get('invoices')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'read')
  @ApiOperation({
    summary: 'List invoices (filter by status, currency, q, requestInvoiceId)',
  })
  list(@Query() query: Record<string, string>) {
    return this.invoicesService.list(listInvoicesQuerySchema.parse(query));
  }

  @Get('invoices/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'read')
  @ApiOperation({
    summary: 'Invoice detail with items, documents and payment summary',
  })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.invoicesService.get(id);
  }

  @Patch('invoices/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'update')
  @ApiOperation({
    summary:
      'Update an invoice (items replace the old ones; refused once payments exist)',
  })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceDto,
    @Req() req: Request,
  ) {
    return this.invoicesService.update(id, body, this.actor(req));
  }

  private actor(req: Request) {
    return {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
  }
}
