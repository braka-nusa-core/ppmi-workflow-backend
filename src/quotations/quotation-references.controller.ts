import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { QuotationReferencesService } from './quotation-references.service';

@ApiTags('Quotation References')
@Controller('quotation-references')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationReferencesController {
  constructor(
    private readonly quotationReferencesService: QuotationReferencesService,
  ) {}

  @Get('templates/:domain')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get an H&M or Cargo quotation template' })
  getTemplate(@Param('domain') domain: string) {
    if (domain !== 'HULL_MACHINERY' && domain !== 'CARGO') {
      throw new BadRequestException('Unsupported quotation template domain');
    }
    return this.quotationReferencesService.getTemplate(domain);
  }

  @Get('adjusters')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List active quotation adjusters' })
  listAdjusters() {
    return this.quotationReferencesService.listAdjusters();
  }

  @Get('surveyors')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List active quotation surveyors' })
  listSurveyors() {
    return this.quotationReferencesService.listSurveyors();
  }
}
