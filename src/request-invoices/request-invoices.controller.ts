import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../policies/policy.shared';
import { REQUEST_INVOICE_DOCUMENT_TYPES } from './request-invoices.constants';
import { RequestInvoicesService } from './request-invoices.service';
import {
  ApproveRequestInvoiceDto,
  CreateRequestInvoiceDto,
  ReturnRequestInvoiceDto,
  UpdateRequestInvoiceDto,
  UploadRequestInvoiceDocumentDto,
  approveRequestInvoiceSchema,
  createRequestInvoiceSchema,
  listRequestInvoicesQuerySchema,
  returnRequestInvoiceSchema,
  updateRequestInvoiceSchema,
  uploadRequestInvoiceDocumentSchema,
} from './request-invoices.validation';

@ApiTags('Request for Invoice')
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class RequestInvoicesController {
  constructor(private readonly service: RequestInvoicesService) {}

  @Post('policies/:policyId/request-invoices')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('request-invoice', 'create')
  @ApiOperation({
    summary: 'Create a draft request for invoice (policy placement completed)',
  })
  @ApiParam({ name: 'policyId', type: String })
  create(
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(createRequestInvoiceSchema))
    body: CreateRequestInvoiceDto,
    @Req() req: Request,
  ) {
    return this.service.create(policyId, body, this.actor(req));
  }

  @Get('request-invoices')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'read')
  @ApiOperation({
    summary: 'List requests for invoice (filter by status, policy)',
  })
  list(@Query() query: Record<string, string>) {
    return this.service.list(listRequestInvoicesQuerySchema.parse(query));
  }

  @Get('request-invoices/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'read')
  @ApiOperation({
    summary: 'Request for invoice with documents, reviews and checklist',
  })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch('request-invoices/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'update')
  @ApiOperation({ summary: 'Update notes (DRAFT or RETURNED_TO_TECHNICAL)' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRequestInvoiceSchema))
    body: UpdateRequestInvoiceDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Post('request-invoices/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('request-invoice', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: {
          type: 'string',
          enum: [...REQUEST_INVOICE_DOCUMENT_TYPES],
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload an RFI document' })
  @ApiParam({ name: 'id', type: String })
  addDocument(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(uploadRequestInvoiceDocumentSchema))
    body: UploadRequestInvoiceDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.service.addDocument(id, body, file, this.actor(req));
  }

  @Delete('request-invoices/:id/documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'update')
  @ApiOperation({ summary: 'Soft delete an RFI document' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'documentId', type: String })
  deleteDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ) {
    return this.service.deleteDocument(id, documentId, this.actor(req));
  }

  @Post('request-invoices/:id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'submit')
  @ApiOperation({
    summary: 'Submit to Finance (all required documents must be uploaded)',
  })
  @ApiParam({ name: 'id', type: String })
  submit(@Param('id') id: string, @Req() req: Request) {
    return this.service.submit(id, this.actor(req));
  }

  @Post('request-invoices/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'review')
  @ApiOperation({ summary: 'Finance approves: READY_FOR_INVOICE' })
  @ApiParam({ name: 'id', type: String })
  approve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveRequestInvoiceSchema))
    body: ApproveRequestInvoiceDto,
    @Req() req: Request,
  ) {
    return this.service.approve(id, body, this.actor(req));
  }

  @Post('request-invoices/:id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'review')
  @ApiOperation({ summary: 'Finance returns to Technical (notes required)' })
  @ApiParam({ name: 'id', type: String })
  return(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(returnRequestInvoiceSchema))
    body: ReturnRequestInvoiceDto,
    @Req() req: Request,
  ) {
    return this.service.return(id, body, this.actor(req));
  }

  @Delete('request-invoices/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('request-invoice', 'update')
  @ApiOperation({ summary: 'Soft delete a request for invoice (DRAFT only)' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.service.delete(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
