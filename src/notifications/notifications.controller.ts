import {
  Controller,
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
import { z } from 'zod';
import { AuthGuard } from '../common/guards/auth.guard';
import { NotificationsService } from './notifications.service';

const listQuerySchema = z.object({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Every user only ever sees their own notifications, so a valid login is
// enough: there is no resource permission to grant.
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List my notifications (unread=true to filter)' })
  list(@Query() query: Record<string, string>, @Req() req: Request) {
    return this.notificationsService.list(
      req.credentials.sub,
      listQuerySchema.parse(query),
    );
  }

  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Count my unread notifications' })
  unreadCount(@Req() req: Request) {
    return this.notificationsService.unreadCount(req.credentials.sub);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@Req() req: Request) {
    return this.notificationsService.markAllRead(req.credentials.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  @ApiParam({ name: 'id', type: String })
  markRead(@Param('id') id: string, @Req() req: Request) {
    return this.notificationsService.markRead(req.credentials.sub, id);
  }
}
