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
import { PniService } from './pni.service';
import {
  CreatePniQuotationDto,
  UpdatePniQuotationDto,
  createPniQuotationSchema,
  updatePniQuotationSchema,
} from './pni.validation';

@ApiTags('P&I Quotations')
@Controller('pni')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PniController {
  constructor(private readonly pniService: PniService) {}

  @Get('club-formats')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List supported P&I club formats' })
  listClubFormats() {
    return this.pniService.listClubFormats();
  }

  @Get('club-formats/:clubFormat/template')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get active templates for a P&I club format' })
  @ApiParam({ name: 'clubFormat', type: String })
  getTemplate(@Param('clubFormat') clubFormat: string) {
    return this.pniService.getTemplate(clubFormat);
  }

  @Get('quotations')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List P&I quotations' })
  list() {
    return this.pniService.list();
  }

  @Get('quotations/:quotationId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get a P&I quotation with all P&I details' })
  @ApiParam({ name: 'quotationId', type: String })
  get(@Param('quotationId') quotationId: string) {
    return this.pniService.get(quotationId);
  }

  @Post('quotations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'create')
  @UsePipes(new ZodValidationPipe(createPniQuotationSchema))
  @ApiOperation({ summary: 'Create a draft quotation with P&I details' })
  create(@Body() body: CreatePniQuotationDto, @Req() req: Request) {
    return this.pniService.create(body, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }

  @Patch('quotations/:quotationId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updatePniQuotationSchema))
  @ApiOperation({ summary: 'Patch P&I quotation details while editable' })
  @ApiParam({ name: 'quotationId', type: String })
  update(
    @Param('quotationId') quotationId: string,
    @Body() body: UpdatePniQuotationDto,
    @Req() req: Request,
  ) {
    return this.pniService.update(quotationId, body, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }
}
