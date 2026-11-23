import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
import { z } from 'zod';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QuotationTermVersionsService } from './quotation-term-versions.service';

const compareQuerySchema = z.object({
  from: z.coerce.number().int().min(1),
  // A version number, or "current" for the live terms. Defaults to current.
  to: z
    .union([z.literal('current'), z.coerce.number().int().min(1)])
    .default('current'),
});

const createVersionSchema = z.object({
  note: z.string().trim().min(1).optional(),
});

@ApiTags('Quotation Term Versions')
@Controller('quotations/:quotationId/term-versions')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
@ApiParam({ name: 'quotationId', type: String })
export class QuotationTermVersionsController {
  constructor(private readonly versionsService: QuotationTermVersionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List saved versions of the quotation terms' })
  list(@Param('quotationId') quotationId: string) {
    return this.versionsService.list(quotationId);
  }

  // Declared before ":version" so "compare" is not read as a version number.
  @Get('compare')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({
    summary:
      'Compare two term versions (?from=1&to=2, or to=current for the live terms)',
  })
  compare(
    @Param('quotationId') quotationId: string,
    @Query() query: Record<string, string>,
  ) {
    const { from, to } = compareQuerySchema.parse(query);
    return this.versionsService.compare(quotationId, from, to);
  }

  @Get(':version')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get one saved version with all of its terms' })
  @ApiParam({ name: 'version', type: Number })
  get(
    @Param('quotationId') quotationId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.versionsService.get(quotationId, version);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Save the current terms as a new version' })
  create(
    @Param('quotationId') quotationId: string,
    @Body(new ZodValidationPipe(createVersionSchema))
    body: z.infer<typeof createVersionSchema>,
    @Req() req: Request,
  ) {
    return this.versionsService.create(quotationId, body.note, {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    });
  }
}
