import { Module } from '@nestjs/common';
import { VesselDocumentsController } from './vessel-documents.controller';
import { VesselDocumentsService } from './vessel-documents.service';
import { VesselRequirementsController } from './vessel-requirements.controller';
import { VesselRequirementsService } from './vessel-requirements.service';
import { VesselSurveysController } from './vessel-surveys.controller';
import { VesselSurveysService } from './vessel-surveys.service';
import { VesselsController } from './vessels.controller';
import { VesselsService } from './vessels.service';

@Module({
  controllers: [
    VesselsController,
    VesselDocumentsController,
    VesselRequirementsController,
    VesselSurveysController,
  ],
  providers: [
    VesselsService,
    VesselDocumentsService,
    VesselRequirementsService,
    VesselSurveysService,
  ],
})
export class VesselsModule {}
