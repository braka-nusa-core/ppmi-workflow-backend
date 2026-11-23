import { Module } from '@nestjs/common';
import { QsTemplatesController } from './qs-templates.controller';
import { QsTemplatesService } from './qs-templates.service';

@Module({
  controllers: [QsTemplatesController],
  providers: [QsTemplatesService],
})
export class QsTemplatesModule {}
