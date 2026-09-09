import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { QuotationsService } from './quotations.service';

@Injectable()
export class QuotationAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async list(quotationId: string) {
    return this.prisma.quotationAttachment.findMany({
      where: { quotationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string, id: string) {
    const att = await this.prisma.quotationAttachment.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!att) throw new NotFoundException('Quotation attachment not found');
    return att;
  }

  async create(
    quotationId: string,
    file: Express.Multer.File,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const key = `quotations/${quotationId}/${randomUUID()}${extname(file.originalname)}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);

    await this.quotationsService.assertEditable(quotationId, actorId);
    const attachment = await this.prisma.quotationAttachment.create({
      data: {
        quotationId,
        fileName: file.originalname,
        url,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return attachment;
  }

  async delete(quotationId: string, id: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationAttachment.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing)
      throw new NotFoundException('Quotation attachment not found');

    await this.prisma.quotationAttachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);

    return { id };
  }
}
