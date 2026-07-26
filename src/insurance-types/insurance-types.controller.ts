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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { InsuranceTypesService } from './insurance-types.service';
import {
  CreateInsuranceTypeDto,
  UpdateInsuranceTypeDto,
  createInsuranceTypeSchema,
  updateInsuranceTypeSchema,
} from './insurance-types.validation';

@ApiTags('Insurance Types')
@Controller('insurance-types')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class InsuranceTypesController {
  constructor(private readonly insuranceTypesService: InsuranceTypesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-type', 'read')
  @ApiOperation({ summary: 'List all insurance types' })
  list() {
    return this.insuranceTypesService.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-type', 'read')
  @ApiOperation({ summary: 'Get insurance type by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.insuranceTypesService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('insurance-type', 'create')
  @UsePipes(new ZodValidationPipe(createInsuranceTypeSchema))
  @ApiOperation({ summary: 'Create a new insurance type' })
  create(@Body() body: CreateInsuranceTypeDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.insuranceTypesService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-type', 'update')
  @UsePipes(new ZodValidationPipe(updateInsuranceTypeSchema))
  @ApiOperation({ summary: 'Update an insurance type' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateInsuranceTypeDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.insuranceTypesService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('insurance-type', 'delete')
  @ApiOperation({ summary: 'Soft delete an insurance type' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.insuranceTypesService.delete(id, actor);
  }
}
