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
import { QuotationObjectsService } from './quotation-objects.service';
import {
  CreateQuotationObjectDto,
  UpdateQuotationObjectDto,
  createQuotationObjectSchema,
  updateQuotationObjectSchema,
} from './quotation-objects.validation';

@ApiTags('Quotation Objects')
@Controller('quotations/:quotationId/objects')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationObjectsController {
  constructor(
    private readonly quotationObjectsService: QuotationObjectsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List objects for a quotation' })
  list(@Param('quotationId') quotationId: string) {
    return this.quotationObjectsService.list(quotationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get a quotation object' })
  get(@Param('quotationId') quotationId: string, @Param('id') id: string) {
    return this.quotationObjectsService.get(quotationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(createQuotationObjectSchema))
  @ApiOperation({ summary: 'Create a quotation object' })
  create(
    @Param('quotationId') quotationId: string,
    @Body() body: CreateQuotationObjectDto,
    @Req() req: Request,
  ) {
    return this.quotationObjectsService.create(
      quotationId,
      body,
      req.credentials.sub,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @UsePipes(new ZodValidationPipe(updateQuotationObjectSchema))
  @ApiOperation({ summary: 'Update a quotation object' })
  update(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Body() body: UpdateQuotationObjectDto,
    @Req() req: Request,
  ) {
    return this.quotationObjectsService.update(
      quotationId,
      id,
      body,
      req.credentials.sub,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Soft delete a quotation object' })
  delete(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.quotationObjectsService.delete(
      quotationId,
      id,
      req.credentials.sub,
    );
  }
}
