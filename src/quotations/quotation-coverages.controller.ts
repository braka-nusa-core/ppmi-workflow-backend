import {
  Body,
  Controller,
  Delete,
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
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QuotationCoveragesService } from './quotation-coverages.service';
import {
  CreateQuotationCoverageDto,
  UpdateQuotationCoverageDto,
  createQuotationCoverageSchema,
  updateQuotationCoverageSchema,
} from './quotation-coverages.validation';

@ApiTags('Quotation Coverages')
@Controller('quotations/:quotationId/coverages')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationCoveragesController {
  constructor(
    private readonly quotationCoveragesService: QuotationCoveragesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List coverages for a quotation' })
  list(@Param('quotationId') quotationId: string) {
    return this.quotationCoveragesService.list(quotationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get a quotation coverage' })
  get(@Param('quotationId') quotationId: string, @Param('id') id: string) {
    return this.quotationCoveragesService.get(quotationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(createQuotationCoverageSchema))
  @ApiOperation({ summary: 'Create a quotation coverage' })
  create(
    @Param('quotationId') quotationId: string,
    @Body() body: CreateQuotationCoverageDto,
    @Req() req: Request,
  ) {
    return this.quotationCoveragesService.create(
      quotationId,
      body,
      req.credentials.sub,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateQuotationCoverageSchema))
  @ApiOperation({ summary: 'Update a quotation coverage' })
  update(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Body() body: UpdateQuotationCoverageDto,
    @Req() req: Request,
  ) {
    return this.quotationCoveragesService.update(
      quotationId,
      id,
      body,
      req.credentials.sub,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Soft delete a quotation coverage' })
  delete(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.quotationCoveragesService.delete(
      quotationId,
      id,
      req.credentials.sub,
    );
  }
}
