import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
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
import { InvoiceNumbersService } from './invoice-numbers.service';
import {
  UpsertInvoiceNumberSettingDto,
  upsertInvoiceNumberSettingSchema,
} from './invoices.validation';

@ApiTags('Invoice Number Settings')
@Controller('invoice-number-settings')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class InvoiceNumberSettingsController {
  constructor(private readonly numbersService: InvoiceNumbersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'read')
  @ApiOperation({
    summary: 'Invoice number suffix per insurance type (default MC)',
  })
  list() {
    return this.numbersService.listSettings();
  }

  @Put(':insuranceTypeId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('invoice', 'update')
  @ApiOperation({
    summary: 'Set the invoice number suffix of an insurance type',
  })
  @ApiParam({ name: 'insuranceTypeId', type: String })
  upsert(
    @Param('insuranceTypeId') insuranceTypeId: string,
    @Body(new ZodValidationPipe(upsertInvoiceNumberSettingSchema))
    body: UpsertInvoiceNumberSettingDto,
    @Req() req: Request,
  ) {
    return this.numbersService.upsertSetting(insuranceTypeId, body.suffix, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }
}
