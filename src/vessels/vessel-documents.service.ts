import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import {
  CreateVesselDocumentDto,
  ListVesselDocumentsQuery,
  UpdateVesselDocumentDto,
} from './vessel-documents.validation';

type Actor = { id: string; fullname: string };

export const DEFAULT_DOCUMENT_CATEGORY = 'OTHER';
export const DEFAULT_DOCUMENT_STATUS = 'AVAILABLE';

@Injectable()
export class VesselDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(vesselId: string, query: ListVesselDocumentsQuery) {
    await this.assertVessel(vesselId);

    return this.prisma.vesselDocument.findMany({
      where: {
        vesselId,
        deletedAt: null,
        ...(query.category && { category: query.category }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    vesselId: string,
    dto: CreateVesselDocumentDto,
    file: Express.Multer.File,
    actor: Actor,
  ) {
    const vessel = await this.assertVessel(vesselId);

    const key = `vessels/${vesselId}/documents/${randomUUID()}${extname(file.originalname)}`;
    const fileUrl = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.vesselDocument.create({
        data: {
          vesselId,
          category: dto.category ?? DEFAULT_DOCUMENT_CATEGORY,
          title: dto.title,
          fileName: file.originalname,
          fileUrl,
          mimeType: file.mimetype,
          fileSize: file.size,
          documentDate: dto.documentDate,
          validFrom: dto.validFrom,
          validUntil: dto.validUntil,
          status: dto.status ?? DEFAULT_DOCUMENT_STATUS,
          note: dto.note,
          uploadedById: actor.id,
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: vesselId,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} uploaded ${document.category} document ${document.fileName} for vessel ${vessel.name}`,
        },
      });

      return document;
    });
  }

  async update(
    vesselId: string,
    id: string,
    dto: UpdateVesselDocumentDto,
    actor: Actor,
  ) {
    const vessel = await this.assertVessel(vesselId);
    const existing = await this.findDocument(vesselId, id);

    const validFrom =
      dto.validFrom !== undefined ? dto.validFrom : existing.validFrom;
    const validUntil =
      dto.validUntil !== undefined ? dto.validUntil : existing.validUntil;
    if (validFrom && validUntil && validFrom > validUntil) {
      throw new BadRequestException(
        'validUntil must not be earlier than validFrom',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.vesselDocument.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.documentDate !== undefined && {
            documentDate: dto.documentDate,
          }),
          ...(dto.validFrom !== undefined && { validFrom: dto.validFrom }),
          ...(dto.validUntil !== undefined && { validUntil: dto.validUntil }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.note !== undefined && { note: dto.note }),
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: vesselId,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} updated document ${document.fileName} of vessel ${vessel.name}`,
        },
      });

      return document;
    });
  }

  async delete(vesselId: string, id: string, actor: Actor) {
    const vessel = await this.assertVessel(vesselId);
    const existing = await this.findDocument(vesselId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.vesselDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: vesselId,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} deleted document ${existing.fileName} of vessel ${vessel.name}`,
        },
      });

      return { id };
    });
  }

  private async assertVessel(vesselId: string) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { id: vesselId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!vessel) throw new NotFoundException('Vessel not found');
    return vessel;
  }

  private async findDocument(vesselId: string, id: string) {
    const document = await this.prisma.vesselDocument.findFirst({
      where: { id, vesselId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Vessel document not found');
    return document;
  }
}
