import { Module } from '@nestjs/common';
import { PlacementService } from './placement.service';
import { PlacementController, PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  controllers: [PlacementController, PoliciesController],
  providers: [PlacementService, PoliciesService],
})
export class PoliciesModule {}
