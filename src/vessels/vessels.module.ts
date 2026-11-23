import { Module } from '@nestjs/common';
import { VesselDocumentsController } from './vessel-documents.controller';
import { VesselDocumentsService } from './vessel-documents.service';
import { VesselSurveysController } from './vessel-surveys.controller';
import { VesselSurveysService } from './vessel-surveys.service';
import { VesselsController } from './vessels.controller';
import { VesselsService } from './vessels.service';

@Module({
  controllers: [
    VesselsController,
    VesselDocumentsController,
    VesselSurveysController,
  ],
  providers: [VesselsService, VesselDocumentsService, VesselSurveysService],
})
export class VesselsModule {}
