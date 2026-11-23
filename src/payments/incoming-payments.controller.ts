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
import { IncomingPaymentsService } from './incoming-payments.service';
import {
  CreateIncomingPaymentDto,
  UpdateIncomingPaymentDto,
  createIncomingPaymentSchema,
  updateIncomingPaymentSchema,
} from './payments.validation';

export const MAX_PROOF_SIZE = 52_428_800;
export const PROOF_FILE_TYPES = /^(application\/pdf|image\/.+)$/;

@ApiTags('Incoming Payments')
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class IncomingPaymentsController {
  constructor(private readonly service: IncomingPaymentsService) {}

  @Get('invoices/:invoiceId/incoming-payments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'read')
  @ApiOperation({
    summary: 'List payments received for an invoice, with balance summary',
  })
  list(@Param('invoiceId') invoiceId: string) {
    return this.service.list(invoiceId);
  }

  @Post('invoices/:invoiceId/incoming-payments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('payment', 'create')
  @ApiOperation({ summary: 'Record a payment received from the client' })
  create(
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(createIncomingPaymentSchema))
    body: CreateIncomingPaymentDto,
    @Req() req: Request,
  ) {
    return this.service.create(invoiceId, body, this.actor(req));
  }

  @Post('incoming-payments/:id/proof')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload proof of payment (PDF or image)' })
  uploadProof(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_PROOF_SIZE }),
          new FileTypeValidator({ fileType: PROOF_FILE_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.service.uploadProof(id, file, this.actor(req));
  }

  @Patch('incoming-payments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'update')
  @ApiOperation({ summary: 'Update a received payment' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateIncomingPaymentSchema))
    body: UpdateIncomingPaymentDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Post('incoming-payments/:id/refund')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'update')
  @ApiOperation({ summary: 'Mark a received payment as refunded' })
  refund(@Param('id') id: string, @Req() req: Request) {
    return this.service.refund(id, this.actor(req));
  }

  @Delete('incoming-payments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'update')
  @ApiOperation({ summary: 'Soft delete a received payment' })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.service.delete(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
