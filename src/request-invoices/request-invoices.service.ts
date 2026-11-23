import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { usersWithPermission } from '../common/utils/permission-users';
import { NotificationsService } from '../notifications/notifications.service';
import { Actor, assertTechnicalUnitOwnership } from '../policies/policy.shared';
import {
  EDITABLE_STATUSES,
  REQUEST_INVOICE_DOCUMENT_TYPES,
  REQUIRED_DOCUMENT_TYPES,
} from './request-invoices.constants';
import {
  ApproveRequestInvoiceDto,
  CreateRequestInvoiceDto,
  ListRequestInvoicesQuery,
  ReturnRequestInvoiceDto,
  UpdateRequestInvoiceDto,
  UploadRequestInvoiceDocumentDto,
} from './request-invoices.validation';

const policySummary = {
  select: {
    id: true,
    policyNumber: true,
    status: true,
    quotationId: true,
    quotation: {
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        technicalUnitId: true,
        client: { select: { id: true, name: true } },
        insuranceType: { select: { id: true, name: true } },
      },
    },
  },
} as const;

@Injectable()
export class RequestInvoicesService {
  private readonly logger = new Logger(RequestInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListRequestInvoicesQuery) {
    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.policyId && { policyId: query.policyId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.requestInvoice.findMany({
        where,
        include: { policy: policySummary },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.requestInvoice.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const rfi = await this.prisma.requestInvoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        policy: policySummary,
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        reviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!rfi) throw new NotFoundException('Request for invoice not found');

    const uploaded = new Set(rfi.documents.map((doc) => doc.documentType));
    const checklist = REQUEST_INVOICE_DOCUMENT_TYPES.map((documentType) => ({
      documentType,
      required: REQUIRED_DOCUMENT_TYPES.includes(documentType),
      uploaded: uploaded.has(documentType),
    }));

    return { ...rfi, checklist };
  }

  async create(policyId: string, dto: CreateRequestInvoiceDto, actor: Actor) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, deletedAt: null },
      select: {
        id: true,
        policyNumber: true,
        status: true,
        quotation: { select: { technicalUnitId: true } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    if (policy.status !== 'PLACEMENT_COMPLETED') {
      throw new BadRequestException(
        'Request for invoice requires a policy with completed placement',
      );
    }
    await assertTechnicalUnitOwnership(
      this.prisma,
      policy.quotation.technicalUnitId,
      actor.id,
    );

    const existing = await this.prisma.requestInvoice.findFirst({
      where: { policyId, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Policy already has a request for invoice');
    }

    const requestNumber = await this.generateRequestNumber();

    return this.prisma.$transaction(async (tx) => {
      const rfi = await tx.requestInvoice.create({
        data: {
          requestNumber,
          policyId,
          status: 'DRAFT',
          notes: dto.notes,
        },
      });

      await this.writeLog(tx, 'CREATE', rfi.id, actor, {
        description: `${actor.fullname} created request for invoice ${rfi.requestNumber} for policy ${policy.policyNumber}`,
      });

      return rfi;
    });
  }

  async update(id: string, dto: UpdateRequestInvoiceDto, actor: Actor) {
    const rfi = await this.findEditable(id, actor);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.requestInvoice.updateMany({
        where: { id, deletedAt: null, status: rfi.status },
        data: { ...(dto.notes !== undefined && { notes: dto.notes }) },
      });
      this.assertChanged(updated.count);

      await this.writeLog(tx, 'UPDATE', id, actor, {
        description: `${actor.fullname} updated request for invoice ${rfi.requestNumber}`,
      });

      return tx.requestInvoice.findFirst({ where: { id } });
    });
  }

  async addDocument(
    id: string,
    dto: UploadRequestInvoiceDocumentDto,
    file: Express.Multer.File,
    actor: Actor,
  ) {
    const rfi = await this.findEditable(id, actor);

    const key = `request-invoices/${id}/${randomUUID()}${extname(file.originalname)}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.requestInvoiceDocument.create({
        data: {
          requestInvoiceId: id,
          documentType: dto.documentType,
          fileName: file.originalname,
          url,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedById: actor.id,
        },
      });

      await this.writeLog(tx, 'UPDATE', id, actor, {
        description: `${actor.fullname} uploaded ${dto.documentType} document ${file.originalname} to request for invoice ${rfi.requestNumber}`,
      });

      return document;
    });
  }

  async deleteDocument(id: string, documentId: string, actor: Actor) {
    const rfi = await this.findEditable(id, actor);

    const document = await this.prisma.requestInvoiceDocument.findFirst({
      where: { id: documentId, requestInvoiceId: id, deletedAt: null },
      select: { id: true, fileName: true },
    });
    if (!document) throw new NotFoundException('Document not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.requestInvoiceDocument.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      await this.writeLog(tx, 'UPDATE', id, actor, {
        description: `${actor.fullname} removed document ${document.fileName} from request for invoice ${rfi.requestNumber}`,
      });

      return { id: documentId };
    });
  }

  async submit(id: string, actor: Actor) {
    const rfi = await this.findEditable(id, actor);

    const submittedAt = new Date();
    const submitted = await this.prisma.$transaction(async (tx) => {
      const documents = await tx.requestInvoiceDocument.findMany({
        where: { requestInvoiceId: id, deletedAt: null },
        select: { documentType: true },
      });
      const uploaded = new Set(documents.map((doc) => doc.documentType));
      const missing = REQUIRED_DOCUMENT_TYPES.filter(
        (type) => !uploaded.has(type),
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Missing required documents: ${missing.join(', ')}`,
        );
      }

      const updated = await tx.requestInvoice.updateMany({
        where: { id, deletedAt: null, status: rfi.status },
        data: {
          status: 'RFI_SUBMITTED',
          submittedById: actor.id,
          submittedAt,
        },
      });
      this.assertChanged(updated.count);

      await this.writeLog(tx, 'UPDATE', id, actor, {
        description: `${actor.fullname} submitted request for invoice ${rfi.requestNumber}`,
      });

      return tx.requestInvoice.findFirst({ where: { id } });
    });

    // A notification problem must never undo a submit that already happened.
    try {
      const recipients = [
        ...new Set(
          await usersWithPermission(this.prisma, 'request-invoice', 'review'),
        ),
      ];
      await this.notifications.createMany(
        recipients.map((recipientId) => ({
          recipientId,
          title: 'Request for Invoice menunggu review',
          message: `RFI ${rfi.requestNumber} untuk polis ${rfi.policy.policyNumber} diajukan oleh ${actor.fullname} dan menunggu review Finance.`,
          type: 'RFI_SUBMITTED',
          referenceType: 'REQUEST_FOR_INVOICE',
          referenceId: id,
          dedupeKey: `RFI_SUBMITTED:${id}:${submittedAt.toISOString()}:${recipientId}`,
        })),
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify finance about ${rfi.requestNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return submitted;
  }

  async approve(id: string, dto: ApproveRequestInvoiceDto, actor: Actor) {
    const rfi = await this.findSubmitted(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.requestInvoice.updateMany({
        where: { id, deletedAt: null, status: 'RFI_SUBMITTED' },
        data: { status: 'READY_FOR_INVOICE' },
      });
      this.assertChanged(updated.count);

      await tx.requestInvoiceReview.create({
        data: {
          requestInvoiceId: id,
          reviewerId: actor.id,
          action: 'APPROVED',
          notes: dto.notes,
        },
      });

      await this.writeLog(tx, 'APPROVE', id, actor, {
        description: `${actor.fullname} approved request for invoice ${rfi.requestNumber}`,
      });

      return tx.requestInvoice.findFirst({ where: { id } });
    });
  }

  async return(id: string, dto: ReturnRequestInvoiceDto, actor: Actor) {
    const rfi = await this.findSubmitted(id);

    const review = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.requestInvoice.updateMany({
        where: { id, deletedAt: null, status: 'RFI_SUBMITTED' },
        data: { status: 'RETURNED_TO_TECHNICAL' },
      });
      this.assertChanged(updated.count);

      const created = await tx.requestInvoiceReview.create({
        data: {
          requestInvoiceId: id,
          reviewerId: actor.id,
          action: 'RETURNED',
          notes: dto.notes,
        },
      });

      await this.writeLog(tx, 'REVISION', id, actor, {
        description: `${actor.fullname} returned request for invoice ${rfi.requestNumber}: ${dto.notes}`,
      });

      return created;
    });

    if (rfi.submittedById) {
      try {
        await this.notifications.createMany([
          {
            recipientId: rfi.submittedById,
            title: 'Request for Invoice dikembalikan',
            message: `RFI ${rfi.requestNumber} untuk polis ${rfi.policy.policyNumber} dikembalikan oleh ${actor.fullname}: ${dto.notes}`,
            type: 'RFI_RETURNED',
            referenceType: 'REQUEST_FOR_INVOICE',
            referenceId: id,
            dedupeKey: `RFI_RETURNED:${id}:${review.id}:${rfi.submittedById}`,
          },
        ]);
      } catch (error) {
        this.logger.error(
          `Failed to notify submitter of ${rfi.requestNumber}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.prisma.requestInvoice.findFirst({ where: { id } });
  }

  async delete(id: string, actor: Actor) {
    const rfi = await this.findRfi(id);
    await this.assertOwnership(rfi, actor);
    if (rfi.status !== 'DRAFT') {
      throw new BadRequestException(
        'Can only delete a request for invoice in DRAFT status',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.requestInvoice.updateMany({
        where: { id, deletedAt: null, status: 'DRAFT' },
        data: { deletedAt: new Date() },
      });
      this.assertChanged(updated.count);

      await this.writeLog(tx, 'DELETE', id, actor, {
        description: `${actor.fullname} deleted request for invoice ${rfi.requestNumber}`,
      });

      return { id };
    });
  }

  /** RFI-YYYYMMDD-NNN, numbered per day. */
  private async generateRequestNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `RFI-${y}${m}${d}-`;

    // Soft-deleted rows keep their number, so they count here too.
    const last = await this.prisma.requestInvoice.findFirst({
      where: { requestNumber: { startsWith: prefix } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true },
    });

    const seq = last ? parseInt(last.requestNumber.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  private async findRfi(id: string) {
    const rfi = await this.prisma.requestInvoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        policy: {
          select: {
            policyNumber: true,
            quotation: { select: { technicalUnitId: true } },
          },
        },
      },
    });
    if (!rfi) throw new NotFoundException('Request for invoice not found');
    return rfi;
  }

  /** Technical actions: RFI must be editable and owned by the actor's unit. */
  private async findEditable(id: string, actor: Actor) {
    const rfi = await this.findRfi(id);
    await this.assertOwnership(rfi, actor);
    if (!EDITABLE_STATUSES.includes(rfi.status)) {
      throw new BadRequestException(
        'Request for invoice can only be changed in DRAFT or RETURNED_TO_TECHNICAL status',
      );
    }
    return rfi;
  }

  private async findSubmitted(id: string) {
    const rfi = await this.findRfi(id);
    if (rfi.status !== 'RFI_SUBMITTED') {
      throw new BadRequestException(
        'Can only review a request for invoice in RFI_SUBMITTED status',
      );
    }
    return rfi;
  }

  private assertOwnership(
    rfi: { policy: { quotation: { technicalUnitId: string | null } } },
    actor: Actor,
  ) {
    return assertTechnicalUnitOwnership(
      this.prisma,
      rfi.policy.quotation.technicalUnitId,
      actor.id,
    );
  }

  private assertChanged(count: number) {
    if (count !== 1) {
      throw new BadRequestException(
        'Request for invoice changed concurrently; retry the request',
      );
    }
  }

  private writeLog(
    tx: Pick<PrismaService, 'log'>,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REVISION',
    referenceId: string,
    actor: Actor,
    data: { description: string },
  ) {
    return tx.log.create({
      data: {
        action,
        referenceId,
        referenceType: 'REQUEST_FOR_INVOICE',
        userId: actor.id,
        description: data.description,
      },
    });
  }
}
