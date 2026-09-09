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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QuotationTermsService } from './quotation-terms.service';
import {
  CreateQuotationTermDto,
  UpdateQuotationTermDto,
  createQuotationTermSchema,
  updateQuotationTermSchema,
} from './quotation-terms.validation';

@ApiTags('Quotation Terms')
@Controller('quotations/:quotationId/terms')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationTermsController {
  constructor(private readonly quotationTermsService: QuotationTermsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List terms for a quotation' })
  list(@Param('quotationId') quotationId: string) {
    return this.quotationTermsService.list(quotationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get a quotation term' })
  get(@Param('quotationId') quotationId: string, @Param('id') id: string) {
    return this.quotationTermsService.get(quotationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(createQuotationTermSchema))
  @ApiOperation({ summary: 'Create a quotation term' })
  create(
    @Param('quotationId') quotationId: string,
    @Body() body: CreateQuotationTermDto,
    @Req() req: Request,
  ) {
    return this.quotationTermsService.create(
      quotationId,
      body,
      req.credentials.sub,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateQuotationTermSchema))
  @ApiOperation({ summary: 'Update a quotation term' })
  update(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Body() body: UpdateQuotationTermDto,
    @Req() req: Request,
  ) {
    return this.quotationTermsService.update(
      quotationId,
      id,
      body,
      req.credentials.sub,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Soft delete a quotation term' })
  delete(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.quotationTermsService.delete(
      quotationId,
      id,
      req.credentials.sub,
    );
  }
}
