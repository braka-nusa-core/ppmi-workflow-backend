import { Module } from '@nestjs/common';
import { QuotationsModule } from '../quotations/quotations.module';
import { CargoService } from './cargo.service';
import { CargoController } from './cargo.controller';

@Module({
  imports: [QuotationsModule],
  controllers: [CargoController],
  providers: [CargoService],
})
export class CargoModule {}
