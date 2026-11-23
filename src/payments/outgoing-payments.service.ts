import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../common/services/prisma.service';
import { StorageService } from '../common/services/storage.service';
import {
  Actor,
  recomputeOutgoingStatus,
  round2,
  sumInstallments,
  toDecimal,
} from './payment.util';
import {
  CreateOutgoingInstallmentDto,
  CreateOutgoingPaymentDto,
  UpdateOutgoingPaymentDto,
} from './payments.validation';

export const DEFAULT_OUTGOING_CURRENCY = 'IDR';

@Injectable()
export class OutgoingPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(policyId: string) {
    const policy = await this.findPolicy(policyId);
    const invoice = await this.findPolicyInvoice(policyId);

    const participants = await this.prisma.policyParticipant.findMany({
      where: { quotationId: policy.quotationId, deletedAt: null },
      include: {
        insuranceCompany: { select: { id: true, code: true, name: true } },
        outgoingPayments: {
          where: { deletedAt: null },
          include: {
            installments: {
              where: { deletedAt: null },
              orderBy: { installmentOrder: 'asc' },
            },
          },
        },
      },
      orderBy: [{ orderNo: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      policyId,
      invoice: invoice && {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        nettPremium: invoice.nettPremium,
      },
      participants: participants.map(({ outgoingPayments, ...participant }) => {
        const payment = outgoingPayments[0] ?? null;
        return {
          ...participant,
          // Only a suggestion: the amount owed to each underwriter is entered by hand.
          suggestedAmount:
            invoice?.nettPremium != null
              ? round2(
                  toDecimal(participant.share)
                    .mul(toDecimal(invoice.nettPremium))
                    .div(100),
                )
              : null,
          outgoingPayment: payment && {
            ...payment,
            paid: payment.installments.reduce(
              (total, i) => total.plus(toDecimal(i.amount)),
              toDecimal(0),
            ),
          },
        };
      }),
    };
  }

  async create(policyId: string, dto: CreateOutgoingPaymentDto, actor: Actor) {
    const policy = await this.findPolicy(policyId);
    const invoice = await this.findPolicyInvoice(policyId);

    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.policyParticipant.findFirst({
        where: {
          id: dto.policyParticipantId,
          quotationId: policy.quotationId,
          deletedAt: null,
        },
        include: { insuranceCompany: { select: { name: true } } },
      });
      if (!participant) {
        throw new BadRequestException(
          'Participant does not belong to this policy',
        );
      }

      // Row lock on the participant so two requests cannot both create a payment.
      await tx.policyParticipant.updateMany({
        where: { id: participant.id },
        data: { updatedAt: new Date() },
      });

      const existing = await tx.outgoingPayment.findFirst({
        where: { policyParticipantId: participant.id, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'This participant already has an outgoing payment',
        );
      }

      const currency =
        dto.currency ?? invoice?.currency ?? DEFAULT_OUTGOING_CURRENCY;

      const payment = await tx.outgoingPayment.create({
        data: {
          policyParticipantId: participant.id,
          amount: dto.amount,
          currency,
          notes: dto.notes,
          status: 'WAITING_PAYMENT',
        },
      });

      await this.log(
        tx,
        'CREATE',
        payment.id,
        actor,
        `created outgoing payment of ${currency} ${toDecimal(dto.amount).toFixed(2)} to ${participant.insuranceCompany.name} for policy ${policy.policyNumber}`,
      );

      return payment;
    });
  }

  async update(id: string, dto: UpdateOutgoingPaymentDto, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findPayment(id, tx);
      await this.lockPayment(tx, id);

      if (dto.amount !== undefined) {
        const paid = await sumInstallments(tx as any, id);
        if (toDecimal(dto.amount).lt(paid)) {
          throw new BadRequestException(
            `Amount cannot be below the ${paid.toFixed(2)} already paid`,
          );
        }
      }

      const payment = await tx.outgoingPayment.update({
        where: { id },
        data: {
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });

      const result = await recomputeOutgoingStatus(tx as any, id);
      await this.log(
        tx,
        'UPDATE',
        id,
        actor,
        `updated outgoing payment of ${existing.policyParticipant.insuranceCompany.name}`,
      );

      return { ...payment, status: result?.status ?? payment.status };
    });
  }

  async addInstallment(
    id: string,
    dto: CreateOutgoingInstallmentDto,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.findPayment(id, tx);
      await this.lockPayment(tx, id);

      const paid = await sumInstallments(tx as any, id);
      const remaining = toDecimal(payment.amount).minus(paid);
      if (toDecimal(dto.amount).gt(remaining)) {
        throw new BadRequestException(
          `Installment exceeds the remaining amount of ${remaining.toFixed(2)}`,
        );
      }

      // Deleted installments are counted so an order number is never reused.
      const last = await tx.outgoingInstallment.findFirst({
        where: { outgoingPaymentId: id },
        orderBy: { installmentOrder: 'desc' },
        select: { installmentOrder: true },
      });

      const installment = await tx.outgoingInstallment.create({
        data: {
          outgoingPaymentId: id,
          installmentOrder: (last?.installmentOrder ?? 0) + 1,
          amount: dto.amount,
          paymentDate: dto.paymentDate,
          notes: dto.notes,
        },
      });

      await recomputeOutgoingStatus(tx as any, id);
      await this.log(
        tx,
        'CREATE',
        id,
        actor,
        `recorded installment ${installment.installmentOrder} of ${toDecimal(dto.amount).toFixed(2)} for outgoing payment of ${payment.policyParticipant.insuranceCompany.name}`,
      );

      return installment;
    });
  }

  async uploadInstallmentProof(
    installmentId: string,
    file: Express.Multer.File,
    actor: Actor,
  ) {
    const installment = await this.findInstallment(installmentId);

    const key = `payments/outgoing/${installmentId}/${randomUUID()}${extname(file.originalname)}`;
    const proofOfPaymentUrl = await this.storage.upload(
      key,
      file.buffer,
      file.mimetype,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.outgoingInstallment.update({
        where: { id: installmentId },
        data: { proofOfPaymentUrl },
      });
      await this.log(
        tx,
        'UPDATE',
        installment.outgoingPaymentId,
        actor,
        `uploaded proof ${file.originalname} for installment ${installment.installmentOrder}`,
      );
      return updated;
    });
  }

  async deleteInstallment(installmentId: string, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const installment = await this.findInstallment(installmentId, tx);
      await this.lockPayment(tx, installment.outgoingPaymentId);

      await tx.outgoingInstallment.update({
        where: { id: installmentId },
        data: { deletedAt: new Date() },
      });

      await recomputeOutgoingStatus(tx as any, installment.outgoingPaymentId);
      await this.log(
        tx,
        'DELETE',
        installment.outgoingPaymentId,
        actor,
        `deleted installment ${installment.installmentOrder} of an outgoing payment`,
      );

      return { id: installmentId };
    });
  }

  private lockPayment(tx: any, id: string) {
    return tx.outgoingPayment.updateMany({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  private async findPolicy(policyId: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, deletedAt: null },
      select: { id: true, quotationId: true, policyNumber: true },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  private findPolicyInvoice(policyId: string) {
    return this.prisma.invoice.findFirst({
      where: {
        deletedAt: null,
        requestInvoice: { policyId, deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        currency: true,
        nettPremium: true,
      },
    });
  }

  private async findPayment(id: string, db: any = this.prisma) {
    const payment = await db.outgoingPayment.findFirst({
      where: { id, deletedAt: null },
      include: {
        policyParticipant: {
          include: { insuranceCompany: { select: { name: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('Outgoing payment not found');
    return payment;
  }

  private async findInstallment(id: string, db: any = this.prisma) {
    const installment = await db.outgoingInstallment.findFirst({
      where: { id, deletedAt: null, outgoingPayment: { deletedAt: null } },
    });
    if (!installment) {
      throw new NotFoundException('Outgoing installment not found');
    }
    return installment;
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
        referenceType: 'OUTGOING_PAYMENT',
        userId: actor.id,
        description: `${actor.fullname} ${description}`,
      },
    });
  }
}
