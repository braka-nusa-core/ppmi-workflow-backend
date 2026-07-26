import { Module } from '@nestjs/common';
import { InsuranceTypesController } from './insurance-types.controller';
import { InsuranceTypesService } from './insurance-types.service';

@Module({
  controllers: [InsuranceTypesController],
  providers: [InsuranceTypesService],
})
export class InsuranceTypesModule {}
