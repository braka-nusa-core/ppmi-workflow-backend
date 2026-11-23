import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CronSecretGuard } from '../common/guards/cron-secret.guard';
import { RemindersService } from './reminders.service';

// Called by a scheduler, not by a logged-in user. Vercel Cron issues GET
// requests, so both methods run the same idempotent job.
@ApiTags('Notifications')
@Controller('notifications/reminders')
@UseGuards(CronSecretGuard)
@ApiBearerAuth()
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create due reminders (scheduler only, Bearer CRON_SECRET)',
  })
  runFromScheduler() {
    return this.remindersService.run();
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create due reminders (scheduler only, Bearer CRON_SECRET)',
  })
  run() {
    return this.remindersService.run();
  }
}
