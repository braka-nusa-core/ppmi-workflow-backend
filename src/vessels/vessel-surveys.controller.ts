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
import { VesselSurveysService } from './vessel-surveys.service';
import {
  CreateVesselSurveyDto,
  UpdateVesselSurveyDto,
  createVesselSurveySchema,
  listVesselSurveysQuerySchema,
  updateVesselSurveySchema,
} from './vessel-surveys.validation';

@ApiTags('Vessel Surveys')
@Controller('vessels/:vesselId/surveys')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
@ApiParam({ name: 'vesselId', type: String })
export class VesselSurveysController {
  constructor(private readonly surveysService: VesselSurveysService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({ summary: 'List surveys of a vessel (filter by status)' })
  list(
    @Param('vesselId') vesselId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.surveysService.list(
      vesselId,
      listVesselSurveysQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({ summary: 'Get a vessel survey' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('vesselId') vesselId: string, @Param('id') id: string) {
    return this.surveysService.get(vesselId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Create (nominate/plan) a vessel survey' })
  create(
    @Param('vesselId') vesselId: string,
    @Body(new ZodValidationPipe(createVesselSurveySchema))
    body: CreateVesselSurveyDto,
    @Req() req: Request,
  ) {
    return this.surveysService.create(vesselId, body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Update a vessel survey' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('vesselId') vesselId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVesselSurveySchema))
    body: UpdateVesselSurveyDto,
    @Req() req: Request,
  ) {
    return this.surveysService.update(vesselId, id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Soft delete a vessel survey' })
  @ApiParam({ name: 'id', type: String })
  delete(
    @Param('vesselId') vesselId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.surveysService.delete(vesselId, id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
