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
  CreateShipmentDocumentDto,
  CreateShipmentDto,
  DeliverShipmentDto,
  ListShipmentsQuery,
  UpdateShipmentDto,
} from './shipments.validation';

type Actor = { id: string; fullname: string };

const shipmentInclude = {
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
  documents: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(query: ListShipmentsQuery) {
    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.invoiceId && { invoiceId: query.invoiceId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, deletedAt: null },
      include: shipmentInclude,
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  async create(invoiceId: string, dto: CreateShipmentDto, actor: Actor) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { id: true, invoiceNumber: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          invoiceId,
          courier: dto.courier,
          trackingNumber: dto.trackingNumber,
          shipmentDate: dto.shipmentDate,
          receiver: dto.receiver,
          notes: dto.notes,
          status: 'SHIPPED',
        },
      });

      await this.log(
        tx,
        'CREATE',
        shipment.id,
        actor,
        `created shipment for invoice ${invoice.invoiceNumber}`,
      );

      return shipment;
    });
  }

  async update(id: string, dto: UpdateShipmentDto, actor: Actor) {
    const existing = await this.findShipment(id);
    if (existing.status === 'COMPLETED') {
      throw new BadRequestException('A completed shipment cannot be changed');
    }

    return this.prisma.$transaction(async (tx) => {
      // Guarded by status so a concurrent completion cannot be overwritten.
      const { count } = await tx.shipment.updateMany({
        where: { id, deletedAt: null, status: { not: 'COMPLETED' } },
        data: {
          ...(dto.courier !== undefined && { courier: dto.courier }),
          ...(dto.trackingNumber !== undefined && {
            trackingNumber: dto.trackingNumber,
          }),
          ...(dto.shipmentDate !== undefined && {
            shipmentDate: dto.shipmentDate,
          }),
          ...(dto.receiver !== undefined && { receiver: dto.receiver }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });
      if (count === 0) {
        throw new BadRequestException('A completed shipment cannot be changed');
      }

      await this.log(tx, 'UPDATE', id, actor, 'updated shipment');
      return tx.shipment.findFirst({ where: { id } });
    });
  }

  async deliver(id: string, dto: DeliverShipmentDto, actor: Actor) {
    const existing = await this.findShipment(id);
    if (existing.status !== 'SHIPPED') {
      throw new BadRequestException('Only a shipped shipment can be delivered');
    }

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.shipment.updateMany({
        where: { id, status: 'SHIPPED', deletedAt: null },
        data: {
          status: 'DELIVERED',
          receivedDate: dto.receivedDate,
          ...(dto.receiver !== undefined && { receiver: dto.receiver }),
        },
      });
      if (count === 0) {
        throw new BadRequestException(
          'Shipment status changed, please reload and try again',
        );
      }

      await this.log(tx, 'UPDATE', id, actor, 'marked shipment as DELIVERED');
      return tx.shipment.findFirst({ where: { id } });
    });
  }

  // Completion needs the client paid in full and every underwriter paid in full.
  async complete(id: string, actor: Actor) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, deletedAt: null },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            status: true,
            requestInvoice: {
              select: { policy: { select: { id: true, quotationId: true } } },
            },
          },
        },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Only a delivered shipment can be completed',
      );
    }

    const problems = await this.findCompletionProblems(shipment.invoice);
    if (problems.length > 0) {
      throw new BadRequestException(
        `Shipment cannot be completed: ${problems.join('; ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.shipment.updateMany({
        where: { id, status: 'DELIVERED', deletedAt: null },
        data: { status: 'COMPLETED' },
      });
      if (count === 0) {
        throw new BadRequestException(
          'Shipment status changed, please reload and try again',
        );
      }

      await this.log(
        tx,
        'UPDATE',
        id,
        actor,
        `marked shipment of invoice ${shipment.invoice.invoiceNumber} as COMPLETED`,
      );
      return tx.shipment.findFirst({ where: { id } });
    });
  }

  async addDocument(
    id: string,
    dto: CreateShipmentDocumentDto,
    file: Express.Multer.File,
    actor: Actor,
  ) {
    await this.findShipment(id);

    const key = `shipments/${id}/${randomUUID()}${extname(file.originalname)}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.shipmentDocument.create({
        data: {
          shipmentId: id,
          documentType: dto.documentType,
          fileName: file.originalname,
          url,
        },
      });

      await this.log(
        tx,
        'CREATE',
        id,
        actor,
        `uploaded ${dto.documentType} document ${file.originalname} to shipment`,
      );
      return document;
    });
  }

  async deleteDocument(id: string, documentId: string, actor: Actor) {
    await this.findShipment(id);
    const document = await this.prisma.shipmentDocument.findFirst({
      where: { id: documentId, shipmentId: id, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Shipment document not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.shipmentDocument.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      await this.log(
        tx,
        'DELETE',
        id,
        actor,
        `deleted document ${document.fileName ?? documentId} from shipment`,
      );
      return { id: documentId };
    });
  }

  private async findCompletionProblems(invoice: {
    status: string;
    requestInvoice: { policy: { id: string; quotationId: string } };
  }) {
    const problems: string[] = [];
    if (invoice.status !== 'PAID') {
      problems.push(`invoice is not paid (status ${invoice.status})`);
    }

    const participants = await this.prisma.policyParticipant.findMany({
      where: {
        quotationId: invoice.requestInvoice.policy.quotationId,
        deletedAt: null,
      },
      include: {
        insuranceCompany: { select: { name: true } },
        outgoingPayments: { where: { deletedAt: null } },
      },
    });

    if (participants.length === 0) {
      problems.push('the policy has no placement participants');
    }

    const noPayment: string[] = [];
    const notFullyPaid: string[] = [];
    for (const participant of participants) {
      const payment = participant.outgoingPayments[0];
      if (!payment) noPayment.push(participant.insuranceCompany.name);
      else if (payment.status !== 'FULLY_PAID') {
        notFullyPaid.push(participant.insuranceCompany.name);
      }
    }
    if (noPayment.length > 0) {
      problems.push(`no outgoing payment for ${noPayment.join(', ')}`);
    }
    if (notFullyPaid.length > 0) {
      problems.push(
        `outgoing payment not fully paid for ${notFullyPaid.join(', ')}`,
      );
    }

    return problems;
  }

  private async findShipment(id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  private log(
    tx: any,
    action: string,
    referenceId: string,
    actor: Actor,
    description: string,
  ) {
    return tx.log.create({
      data: {
        action,
        referenceId,
        referenceType: 'SHIPMENT',
        userId: actor.id,
        description: `${actor.fullname} ${description}`,
      },
    });
  }
}
