import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationObjectsController } from './quotation-objects.controller';
import { QuotationObjectsService } from './quotation-objects.service';
import { QuotationCoveragesController } from './quotation-coverages.controller';
import { QuotationCoveragesService } from './quotation-coverages.service';
import { QuotationTermsController } from './quotation-terms.controller';
import { QuotationTermsService } from './quotation-terms.service';
import { QuotationWarrantiesController } from './quotation-warranties.controller';
import { QuotationWarrantiesService } from './quotation-warranties.service';
import { QuotationAttachmentsController } from './quotation-attachments.controller';
import { QuotationAttachmentsService } from './quotation-attachments.service';
import { QuotationReferencesController } from './quotation-references.controller';
import { QuotationReferencesService } from './quotation-references.service';
import { TechnicalQuotationValidationService } from './technical-quotation-validation.service';

@Module({
  imports: [ClientsModule],
  controllers: [
    QuotationsController,
    QuotationObjectsController,
    QuotationCoveragesController,
    QuotationTermsController,
    QuotationWarrantiesController,
    QuotationAttachmentsController,
    QuotationReferencesController,
  ],
  providers: [
    QuotationsService,
    QuotationObjectsService,
    QuotationCoveragesService,
    QuotationTermsService,
    QuotationWarrantiesService,
    QuotationAttachmentsService,
    QuotationReferencesService,
    TechnicalQuotationValidationService,
  ],
  exports: [QuotationsService],
})
export class QuotationsModule {}
