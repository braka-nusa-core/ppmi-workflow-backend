import { Module } from '@nestjs/common';
import { QuotationsModule } from '../quotations/quotations.module';
import { HmService } from './hm.service';
import { HmController } from './hm.controller';

@Module({
  imports: [QuotationsModule],
  controllers: [HmController],
  providers: [HmService],
})
export class HmModule {}
