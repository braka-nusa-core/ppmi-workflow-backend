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
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QuotationWarrantiesService } from './quotation-warranties.service';
import {
  CreateQuotationWarrantyDto,
  UpdateQuotationWarrantyDto,
  createQuotationWarrantySchema,
  updateQuotationWarrantySchema,
} from './quotation-warranties.validation';

@ApiTags('Quotation Warranties')
@Controller('quotations/:quotationId/warranties')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationWarrantiesController {
  constructor(
    private readonly quotationWarrantiesService: QuotationWarrantiesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List warranties for a quotation' })
  list(@Param('quotationId') quotationId: string) {
    return this.quotationWarrantiesService.list(quotationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get a quotation warranty' })
  get(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
  ) {
    return this.quotationWarrantiesService.get(quotationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(createQuotationWarrantySchema))
  @ApiOperation({ summary: 'Create a quotation warranty' })
  create(
    @Param('quotationId') quotationId: string,
    @Body() body: CreateQuotationWarrantyDto,
  ) {
    return this.quotationWarrantiesService.create(quotationId, body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateQuotationWarrantySchema))
  @ApiOperation({ summary: 'Update a quotation warranty' })
  update(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Body() body: UpdateQuotationWarrantyDto,
  ) {
    return this.quotationWarrantiesService.update(quotationId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Soft delete a quotation warranty' })
  delete(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
  ) {
    return this.quotationWarrantiesService.delete(quotationId, id);
  }
}
