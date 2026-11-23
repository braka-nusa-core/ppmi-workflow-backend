import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
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
import { InvoiceDocumentsService } from './invoice-documents.service';
import {
  CreateInvoiceDocumentDto,
  createInvoiceDocumentSchema,
} from './invoices.validation';

const MAX_FILE_SIZE = 52_428_800;
const ALLOWED_FILE_TYPES = /^(application\/pdf|image\/.+)$/;

@ApiTags('Invoice Documents')
@Controller('invoices/:invoiceId/documents')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
@ApiParam({ name: 'invoiceId', type: String })
export class InvoiceDocumentsController {
  constructor(private readonly documentsService: InvoiceDocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('invoice', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', enum: ['INVOICE_PDF', 'VOUCHER'] },
      },
    },
  })
  @ApiOperation({ summary: 'Upload the invoice PDF or a voucher' })
  create(
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(createInvoiceDocumentSchema))
    body: CreateInvoiceDocumentDto,
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
    return this.documentsService.create(invoiceId, body, file, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'update')
  @ApiOperation({ summary: 'Soft delete an invoice document' })
  @ApiParam({ name: 'id', type: String })
  delete(
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.documentsService.delete(invoiceId, id, this.actor(req));
  }

  private actor(req: Request) {
    return {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
  }
}
