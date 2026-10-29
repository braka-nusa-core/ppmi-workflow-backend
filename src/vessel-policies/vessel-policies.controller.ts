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
import { VesselPoliciesService } from './vessel-policies.service';
import {
  CreateVesselPolicyDto,
  UpdateVesselPolicyDto,
  createVesselPolicySchema,
  listVesselPoliciesQuerySchema,
  updateVesselPolicySchema,
} from './vessel-policies.validation';

@ApiTags('Vessel Policies')
@Controller('vessel-policies')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class VesselPoliciesController {
  constructor(private readonly vesselPoliciesService: VesselPoliciesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel-policy', 'read')
  @ApiOperation({
    summary:
      'List vessel policies (filter by client, vessel, status, or expiry)',
  })
  list(@Query() query: Record<string, string>) {
    return this.vesselPoliciesService.list(
      listVesselPoliciesQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel-policy', 'read')
  @ApiOperation({ summary: 'Get vessel policy by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.vesselPoliciesService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vessel-policy', 'create')
  @UsePipes(new ZodValidationPipe(createVesselPolicySchema))
  @ApiOperation({ summary: 'Create a new vessel policy' })
  create(@Body() body: CreateVesselPolicyDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.vesselPoliciesService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel-policy', 'update')
  @UsePipes(new ZodValidationPipe(updateVesselPolicySchema))
  @ApiOperation({ summary: 'Update a vessel policy' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateVesselPolicyDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.vesselPoliciesService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel-policy', 'delete')
  @ApiOperation({ summary: 'Soft delete a vessel policy' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.vesselPoliciesService.delete(id, actor);
  }
}
