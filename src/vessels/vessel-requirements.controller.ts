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
import { VesselRequirementsService } from './vessel-requirements.service';
import {
  CreateVesselRequirementDto,
  UpdateVesselRequirementDto,
  createVesselRequirementSchema,
  updateVesselRequirementSchema,
} from './vessel-requirements.validation';

@ApiTags('Vessel Document Requirements')
@Controller('vessel-document-requirements')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class VesselRequirementsController {
  constructor(
    private readonly requirementsService: VesselRequirementsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({ summary: 'List the document categories a vessel must have' })
  list() {
    return this.requirementsService.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vessel', 'update')
  @ApiOperation({
    summary: 'Require a document category (all vessels, or one vessel type)',
  })
  create(
    @Body(new ZodValidationPipe(createVesselRequirementSchema))
    body: CreateVesselRequirementDto,
    @Req() req: Request,
  ) {
    return this.requirementsService.create(body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Update a required document category' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVesselRequirementSchema))
    body: UpdateVesselRequirementDto,
    @Req() req: Request,
  ) {
    return this.requirementsService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Soft delete a required document category' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.requirementsService.delete(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
