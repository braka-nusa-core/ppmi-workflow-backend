import { Module } from '@nestjs/common';
import { FollowUpsController, MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  controllers: [MeetingsController, FollowUpsController],
  providers: [MeetingsService],
})
export class MeetingsModule {}
