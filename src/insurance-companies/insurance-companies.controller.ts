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
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { InsuranceCompaniesService } from './insurance-companies.service';
import {
  CreateInsuranceCompanyDto,
  UpdateInsuranceCompanyDto,
  createInsuranceCompanySchema,
  listInsuranceCompaniesQuerySchema,
  updateInsuranceCompanySchema,
} from './insurance-companies.validation';

@ApiTags('Insurance Companies')
@Controller('insurance-companies')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class InsuranceCompaniesController {
  constructor(private readonly service: InsuranceCompaniesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-company', 'read')
  @ApiOperation({ summary: 'List insurance companies (search by code/name)' })
  list(@Query() query: Record<string, string>) {
    return this.service.list(listInsuranceCompaniesQuerySchema.parse(query));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-company', 'read')
  @ApiOperation({ summary: 'Get an insurance company' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('insurance-company', 'create')
  @ApiOperation({ summary: 'Create an insurance company' })
  create(
    @Body(new ZodValidationPipe(createInsuranceCompanySchema))
    body: CreateInsuranceCompanyDto,
    @Req() req: Request,
  ) {
    return this.service.create(body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-company', 'update')
  @ApiOperation({ summary: 'Update an insurance company' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInsuranceCompanySchema))
    body: UpdateInsuranceCompanyDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-company', 'delete')
  @ApiOperation({
    summary:
      'Soft delete an insurance company (refused while used in a placement)',
  })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.service.delete(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
