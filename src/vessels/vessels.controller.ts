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
import { VesselsService } from './vessels.service';
import {
  CreateVesselDto,
  UpdateVesselDto,
  createVesselSchema,
  listVesselsQuerySchema,
  updateVesselSchema,
} from './vessels.validation';

@ApiTags('Vessels')
@Controller('vessels')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class VesselsController {
  constructor(private readonly vesselsService: VesselsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({ summary: 'List vessels (paginated, filter by name)' })
  list(@Query() query: Record<string, string>) {
    return this.vesselsService.list(listVesselsQuerySchema.parse(query));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({ summary: 'Get vessel by ID, with its active policies' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.vesselsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vessel', 'create')
  @UsePipes(new ZodValidationPipe(createVesselSchema))
  @ApiOperation({ summary: 'Create a new vessel' })
  create(@Body() body: CreateVesselDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.vesselsService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @UsePipes(new ZodValidationPipe(updateVesselSchema))
  @ApiOperation({ summary: 'Update a vessel' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateVesselDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.vesselsService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'delete')
  @ApiOperation({ summary: 'Soft delete a vessel (blocked if it has active policies)' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.vesselsService.delete(id, actor);
  }
}
