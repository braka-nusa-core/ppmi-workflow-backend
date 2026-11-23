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
import { MeetingsService } from './meetings.service';
import {
  CreateFollowUpDto,
  CreateMeetingDto,
  UpdateFollowUpDto,
  UpdateMeetingDto,
  createFollowUpSchema,
  createMeetingSchema,
  listFollowUpsQuerySchema,
  listMeetingsQuerySchema,
  updateFollowUpSchema,
  updateMeetingSchema,
} from './meetings.validation';

const actorOf = (req: Request) => ({
  id: req.credentials.sub,
  fullname: req.credentials.fullname,
});

@ApiTags('Meetings')
@Controller('meetings')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'read')
  @ApiOperation({
    summary: 'List meetings (filter by entity and date range)',
  })
  list(@Query() query: Record<string, string>) {
    return this.meetingsService.listMeetings(
      listMeetingsQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'read')
  @ApiOperation({ summary: 'Get a meeting with its follow-ups' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.meetingsService.getMeeting(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('meeting', 'create')
  @ApiOperation({
    summary:
      'Record a meeting, optionally with follow-ups, linked to an entity',
  })
  create(
    @Body(new ZodValidationPipe(createMeetingSchema)) body: CreateMeetingDto,
    @Req() req: Request,
  ) {
    return this.meetingsService.createMeeting(body, actorOf(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'update')
  @ApiOperation({ summary: 'Update a meeting' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMeetingSchema)) body: UpdateMeetingDto,
    @Req() req: Request,
  ) {
    return this.meetingsService.updateMeeting(id, body, actorOf(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'delete')
  @ApiOperation({ summary: 'Soft delete a meeting and its follow-ups' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.meetingsService.deleteMeeting(id, actorOf(req));
  }
}

@ApiTags('Follow-ups')
@Controller('follow-ups')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class FollowUpsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'read')
  @ApiOperation({
    summary:
      'List follow-ups (filter by meeting, entity, assignee, status, dueBefore)',
  })
  list(@Query() query: Record<string, string>) {
    return this.meetingsService.listFollowUps(
      listFollowUpsQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'read')
  @ApiOperation({ summary: 'Get a follow-up' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.meetingsService.getFollowUp(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('meeting', 'create')
  @ApiOperation({ summary: 'Create a follow-up task' })
  create(
    @Body(new ZodValidationPipe(createFollowUpSchema)) body: CreateFollowUpDto,
    @Req() req: Request,
  ) {
    return this.meetingsService.createFollowUp(body, actorOf(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'update')
  @ApiOperation({ summary: 'Update a follow-up or change its status' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFollowUpSchema)) body: UpdateFollowUpDto,
    @Req() req: Request,
  ) {
    return this.meetingsService.updateFollowUp(id, body, actorOf(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('meeting', 'delete')
  @ApiOperation({ summary: 'Soft delete a follow-up' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.meetingsService.deleteFollowUp(id, actorOf(req));
  }
}
