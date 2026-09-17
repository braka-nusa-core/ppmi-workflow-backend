import {
  Body,
  Controller,
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { CargoService } from './cargo.service';
import {
  CreateCargoQuotationDto,
  UpdateCargoQuotationDto,
  createCargoQuotationSchema,
  updateCargoQuotationSchema,
} from './cargo.validation';

@ApiTags('Cargo Quotations')
@Controller('cargo')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @Get('template')
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get the Cargo quotation template' })
  getTemplate() {
    return this.cargoService.getTemplate();
  }

  @Post('quotations/:quotationId')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(createCargoQuotationSchema))
  @ApiOperation({ summary: 'Create Cargo quotation detail' })
  create(
    @Param('quotationId') quotationId: string,
    @Body() body: CreateCargoQuotationDto,
    @Req() req: Request,
  ) {
    return this.cargoService.create(quotationId, body, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }

  @Get('quotations/:quotationId')
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get Cargo quotation detail' })
  get(@Param('quotationId') quotationId: string) {
    return this.cargoService.get(quotationId);
  }

  @Patch('quotations/:quotationId')
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateCargoQuotationSchema))
  @ApiOperation({ summary: 'Update Cargo quotation detail' })
  update(
    @Param('quotationId') quotationId: string,
    @Body() body: UpdateCargoQuotationDto,
    @Req() req: Request,
  ) {
    return this.cargoService.update(quotationId, body, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }
}
