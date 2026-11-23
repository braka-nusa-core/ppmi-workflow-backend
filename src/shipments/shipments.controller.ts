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
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { ShipmentsService } from './shipments.service';
import {
  CreateShipmentDocumentDto,
  CreateShipmentDto,
  DeliverShipmentDto,
  UpdateShipmentDto,
  createShipmentDocumentSchema,
  createShipmentSchema,
  deliverShipmentSchema,
  listShipmentsQuerySchema,
  updateShipmentSchema,
} from './shipments.validation';

const MAX_FILE_SIZE = 52_428_800;
const ALLOWED_FILE_TYPES =
  /^(application\/pdf|image\/.+|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-.+)$/;

@ApiTags('Shipments')
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ShipmentsController {
  constructor(private readonly service: ShipmentsService) {}

  @Get('shipments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('shipment', 'read')
  @ApiOperation({ summary: 'List shipments (filter by status, invoiceId)' })
  list(@Query() query: Record<string, string>) {
    return this.service.list(listShipmentsQuerySchema.parse(query));
  }

  @Get('shipments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('shipment', 'read')
  @ApiOperation({
    summary: 'Shipment detail with documents and invoice number',
  })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('invoices/:invoiceId/shipments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('shipment', 'create')
  @ApiOperation({ summary: 'Create a shipment (status SHIPPED)' })
  create(
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(createShipmentSchema))
    body: CreateShipmentDto,
    @Req() req: Request,
  ) {
    return this.service.create(invoiceId, body, this.actor(req));
  }

  @Patch('shipments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('shipment', 'update')
  @ApiOperation({ summary: 'Update shipment data (not after COMPLETED)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateShipmentSchema))
    body: UpdateShipmentDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Post('shipments/:id/deliver')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('shipment', 'update')
  @ApiOperation({ summary: 'SHIPPED to DELIVERED with received date' })
  deliver(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(deliverShipmentSchema))
    body: DeliverShipmentDto,
    @Req() req: Request,
  ) {
    return this.service.deliver(id, body, this.actor(req));
  }

  @Post('shipments/:id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('shipment', 'update')
  @ApiOperation({
    summary:
      'DELIVERED to COMPLETED. Needs a paid invoice and fully paid underwriters.',
  })
  complete(@Param('id') id: string, @Req() req: Request) {
    return this.service.complete(id, this.actor(req));
  }

  @Post('shipments/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('shipment', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string', description: 'Free text.' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a shipment document' })
  addDocument(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createShipmentDocumentSchema))
    body: CreateShipmentDocumentDto,
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

  @Delete('shipments/:id/documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('shipment', 'update')
  @ApiOperation({ summary: 'Soft delete a shipment document' })
  deleteDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ) {
    return this.service.deleteDocument(id, documentId, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
