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
import {
  MAX_PROOF_SIZE,
  PROOF_FILE_TYPES,
} from './incoming-payments.controller';
import { OutgoingPaymentsService } from './outgoing-payments.service';
import {
  CreateOutgoingInstallmentDto,
  CreateOutgoingPaymentDto,
  UpdateOutgoingPaymentDto,
  createOutgoingInstallmentSchema,
  createOutgoingPaymentSchema,
  updateOutgoingPaymentSchema,
} from './payments.validation';

@ApiTags('Outgoing Payments')
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class OutgoingPaymentsController {
  constructor(private readonly service: OutgoingPaymentsService) {}

  @Get('policies/:policyId/outgoing-payments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'read')
  @ApiOperation({
    summary:
      'Placement participants of the policy with their outgoing payment and suggested amount',
  })
  list(@Param('policyId') policyId: string) {
    return this.service.list(policyId);
  }

  @Post('policies/:policyId/outgoing-payments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('payment', 'create')
  @ApiOperation({ summary: 'Create the outgoing payment of a participant' })
  create(
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(createOutgoingPaymentSchema))
    body: CreateOutgoingPaymentDto,
    @Req() req: Request,
  ) {
    return this.service.create(policyId, body, this.actor(req));
  }

  @Patch('outgoing-payments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'update')
  @ApiOperation({ summary: 'Update amount, currency or notes' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOutgoingPaymentSchema))
    body: UpdateOutgoingPaymentDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Post('outgoing-payments/:id/installments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('payment', 'create')
  @ApiOperation({ summary: 'Record a payment made to the underwriter' })
  addInstallment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createOutgoingInstallmentSchema))
    body: CreateOutgoingInstallmentDto,
    @Req() req: Request,
  ) {
    return this.service.addInstallment(id, body, this.actor(req));
  }

  @Post('outgoing-installments/:id/proof')
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
    return this.service.uploadInstallmentProof(id, file, this.actor(req));
  }

  @Delete('outgoing-installments/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payment', 'update')
  @ApiOperation({ summary: 'Soft delete an installment' })
  deleteInstallment(@Param('id') id: string, @Req() req: Request) {
    return this.service.deleteInstallment(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
