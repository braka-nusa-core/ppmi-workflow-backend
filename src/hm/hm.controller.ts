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
import { HmService } from './hm.service';
import {
  CreateHmQuotationDto,
  UpdateHmQuotationDto,
  createHmQuotationSchema,
  updateHmQuotationSchema,
} from './hm.validation';

@ApiTags('H&M Quotations')
@Controller('hm')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class HmController {
  constructor(private readonly hmService: HmService) {}

  @Get('template')
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get the H&M quotation template' })
  getTemplate() {
    return this.hmService.getTemplate();
  }

  @Post('quotations/:quotationId')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(createHmQuotationSchema))
  @ApiOperation({ summary: 'Create H&M quotation detail' })
  create(
    @Param('quotationId') quotationId: string,
    @Body() body: CreateHmQuotationDto,
    @Req() req: Request,
  ) {
    return this.hmService.create(quotationId, body, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }

  @Get('quotations/:quotationId')
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get H&M quotation detail' })
  get(@Param('quotationId') quotationId: string) {
    return this.hmService.get(quotationId);
  }

  @Patch('quotations/:quotationId')
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateHmQuotationSchema))
  @ApiOperation({ summary: 'Update H&M quotation detail' })
  update(
    @Param('quotationId') quotationId: string,
    @Body() body: UpdateHmQuotationDto,
    @Req() req: Request,
  ) {
    return this.hmService.update(quotationId, body, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }
}
