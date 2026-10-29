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
import { ClubsService } from './clubs.service';
import {
  CreateClubDto,
  UpdateClubDto,
  createClubSchema,
  updateClubSchema,
} from './clubs.validation';

@ApiTags('Clubs')
@Controller('clubs')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('club', 'read')
  @ApiOperation({ summary: 'List all active clubs' })
  list() {
    return this.clubsService.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('club', 'read')
  @ApiOperation({ summary: 'Get club by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.clubsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('club', 'create')
  @UsePipes(new ZodValidationPipe(createClubSchema))
  @ApiOperation({ summary: 'Create a new club' })
  create(@Body() body: CreateClubDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clubsService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('club', 'update')
  @UsePipes(new ZodValidationPipe(updateClubSchema))
  @ApiOperation({
    summary: 'Update a club (code can only change before it is in use)',
  })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateClubDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clubsService.update(id, body, actor);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('club', 'update')
  @ApiOperation({ summary: 'Restore a soft-deleted club' })
  @ApiParam({ name: 'id', type: String })
  restore(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clubsService.restore(id, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('club', 'delete')
  @ApiOperation({ summary: 'Soft delete a club' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clubsService.delete(id, actor);
  }
}
