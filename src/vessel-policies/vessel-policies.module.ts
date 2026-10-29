import { Module } from '@nestjs/common';
import { VesselPoliciesController } from './vessel-policies.controller';
import { VesselPoliciesService } from './vessel-policies.service';

@Module({
  controllers: [VesselPoliciesController],
  providers: [VesselPoliciesService],
})
export class VesselPoliciesModule {}
