import { Module } from '@nestjs/common';
import { QsOptionsController } from './qs-options.controller';
import { QsOptionsService } from './qs-options.service';

@Module({
  controllers: [QsOptionsController],
  providers: [QsOptionsService],
})
export class QsOptionsModule {}
