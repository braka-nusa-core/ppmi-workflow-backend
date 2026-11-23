import { Module } from '@nestjs/common';
import { InsuranceCompaniesController } from './insurance-companies.controller';
import { InsuranceCompaniesService } from './insurance-companies.service';

@Module({
  controllers: [InsuranceCompaniesController],
  providers: [InsuranceCompaniesService],
})
export class InsuranceCompaniesModule {}
