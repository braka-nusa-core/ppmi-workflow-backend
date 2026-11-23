import { Module } from '@nestjs/common';
import { InvoiceDocumentsController } from './invoice-documents.controller';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { InvoiceNumberSettingsController } from './invoice-number-settings.controller';
import { InvoiceNumbersService } from './invoice-numbers.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [
    InvoicesController,
    InvoiceDocumentsController,
    InvoiceNumberSettingsController,
  ],
  providers: [InvoicesService, InvoiceNumbersService, InvoiceDocumentsService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
