import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { CreateInvoiceDocumentDto } from './invoices.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class InvoiceDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(
    invoiceId: string,
    dto: CreateInvoiceDocumentDto,
    file: Express.Multer.File,
    actor: Actor,
  ) {
    const invoice = await this.assertInvoice(invoiceId);

    const key = `invoices/${invoiceId}/${randomUUID()}${extname(file.originalname)}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.invoiceDocument.create({
        data: {
          invoiceId,
          documentType: dto.documentType,
          fileName: file.originalname,
          url,
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: invoiceId,
          referenceType: 'INVOICE',
          userId: actor.id,
          description: `${actor.fullname} uploaded ${dto.documentType} ${file.originalname} for invoice ${invoice.invoiceNumber}`,
        },
      });

      return document;
    });
  }

  async delete(invoiceId: string, id: string, actor: Actor) {
    const invoice = await this.assertInvoice(invoiceId);
    const document = await this.prisma.invoiceDocument.findFirst({
      where: { id, invoiceId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Invoice document not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: invoiceId,
          referenceType: 'INVOICE',
          userId: actor.id,
          description: `${actor.fullname} deleted ${document.documentType} ${document.fileName} of invoice ${invoice.invoiceNumber}`,
        },
      });

      return { id };
    });
  }

  private async assertInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { id: true, invoiceNumber: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
