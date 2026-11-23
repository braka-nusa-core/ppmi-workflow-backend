import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { usersWithPermission } from '../common/utils/permission-users';
import { NewNotification, NotificationsService } from './notifications.service';
import {
  ReminderType,
  dateKey,
  getReminderDays,
  reminderWindow,
} from './reminder.config';

type Candidate = {
  /** Stable id of the thing that is due, used for the dedupe key. */
  sourceId: string;
  dueDate: Date;
  title: string;
  message: string;
  referenceType: string;
  referenceId: string;
  recipientIds: string[];
};

const formatDate = (date: Date) => dateKey(date);

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Creates reminders for everything that falls due inside its window.
   * Safe to run as often as needed: the unique dedupeKey (type, source,
   * due date, recipient) means the same reminder is never created twice.
   */
  async run(now = new Date()) {
    const created: Record<ReminderType, number> = {
      VESSEL_DOCUMENT_EXPIRING: 0,
      VESSEL_SURVEY_EXPIRING: 0,
      INSTALLMENT_DUE: 0,
      FOLLOW_UP_DUE: 0,
    };

    const collectors: [ReminderType, () => Promise<Candidate[]>][] = [
      ['VESSEL_DOCUMENT_EXPIRING', () => this.vesselDocuments(now)],
      ['VESSEL_SURVEY_EXPIRING', () => this.vesselSurveys(now)],
      ['INSTALLMENT_DUE', () => this.installments(now)],
      ['FOLLOW_UP_DUE', () => this.followUps(now)],
    ];

    const errors: { type: ReminderType; message: string }[] = [];
    for (const [type, collect] of collectors) {
      try {
        const candidates = await collect();
        created[type] = await this.notifications.createMany(
          this.toNotifications(type, candidates),
        );
      } catch (error) {
        // One failing source must not stop the other reminders.
        errors.push({
          type,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      created,
      total: Object.values(created).reduce((sum, count) => sum + count, 0),
      errors,
    };
  }

  private toNotifications(
    type: ReminderType,
    candidates: Candidate[],
  ): NewNotification[] {
    return candidates.flatMap((candidate) =>
      [...new Set(candidate.recipientIds)].map((recipientId) => ({
        recipientId,
        title: candidate.title,
        message: candidate.message,
        type,
        referenceType: candidate.referenceType,
        referenceId: candidate.referenceId,
        dueDate: candidate.dueDate,
        dedupeKey: `${type}:${candidate.sourceId}:${dateKey(candidate.dueDate)}:${recipientId}`,
      })),
    );
  }

  private async vesselDocuments(now: Date): Promise<Candidate[]> {
    const { start, end } = reminderWindow(
      now,
      getReminderDays('VESSEL_DOCUMENT_EXPIRING'),
    );
    const documents = await this.prisma.vesselDocument.findMany({
      where: {
        deletedAt: null,
        validUntil: { gte: start, lte: end },
        vessel: { deletedAt: null },
      },
      select: {
        id: true,
        vesselId: true,
        category: true,
        fileName: true,
        validUntil: true,
        vessel: { select: { name: true } },
      },
    });

    const candidates: Candidate[] = [];
    for (const document of documents) {
      candidates.push({
        sourceId: document.id,
        dueDate: document.validUntil!,
        title: 'Dokumen kapal segera kedaluwarsa',
        message: `Dokumen ${document.category} (${document.fileName}) kapal ${document.vessel.name} berlaku sampai ${formatDate(document.validUntil!)}.`,
        referenceType: 'VESSEL',
        referenceId: document.vesselId,
        recipientIds: await this.vesselRecipients(document.vesselId),
      });
    }
    return candidates;
  }

  private async vesselSurveys(now: Date): Promise<Candidate[]> {
    const { start, end } = reminderWindow(
      now,
      getReminderDays('VESSEL_SURVEY_EXPIRING'),
    );
    const surveys = await this.prisma.vesselSurvey.findMany({
      where: {
        deletedAt: null,
        status: { not: 'CANCELLED' },
        validUntil: { gte: start, lte: end },
        vessel: { deletedAt: null },
      },
      select: {
        id: true,
        vesselId: true,
        surveyType: true,
        validUntil: true,
        vessel: { select: { name: true } },
      },
    });

    const candidates: Candidate[] = [];
    for (const survey of surveys) {
      candidates.push({
        sourceId: survey.id,
        dueDate: survey.validUntil!,
        title: 'Survey kapal segera kedaluwarsa',
        message: `${survey.surveyType ? `Survey ${survey.surveyType}` : 'Survey'} kapal ${survey.vessel.name} berlaku sampai ${formatDate(survey.validUntil!)}.`,
        referenceType: 'VESSEL',
        referenceId: survey.vesselId,
        recipientIds: await this.vesselRecipients(survey.vesselId),
      });
    }
    return candidates;
  }

  private async installments(now: Date): Promise<Candidate[]> {
    const { start, end } = reminderWindow(
      now,
      getReminderDays('INSTALLMENT_DUE'),
    );
    const dueDate = { gte: start, lte: end };
    const quotationSelect = {
      select: {
        id: true,
        quotationNumber: true,
        createdById: true,
      },
    } as const;

    const [pni, hm, cargo] = await Promise.all([
      this.prisma.pniInstallment.findMany({
        where: {
          deletedAt: null,
          dueDate,
          pniQuotation: { deletedAt: null, quotation: { deletedAt: null } },
        },
        select: {
          id: true,
          installmentNo: true,
          dueDate: true,
          pniQuotation: { select: { quotation: quotationSelect } },
        },
      }),
      this.prisma.hmQuotationInstallment.findMany({
        where: {
          deletedAt: null,
          dueDate,
          hmQuotation: { deletedAt: null, quotation: { deletedAt: null } },
        },
        select: {
          id: true,
          installmentNo: true,
          dueDate: true,
          hmQuotation: { select: { quotation: quotationSelect } },
        },
      }),
      this.prisma.cargoQuotationInstallment.findMany({
        where: {
          deletedAt: null,
          dueDate,
          paymentStatus: { not: 'PAID' },
          cargoQuotation: { deletedAt: null, quotation: { deletedAt: null } },
        },
        select: {
          id: true,
          installmentNo: true,
          dueDate: true,
          cargoQuotation: { select: { quotation: quotationSelect } },
        },
      }),
    ]);

    const rows = [
      ...pni.map((row) => ({ row, quotation: row.pniQuotation.quotation })),
      ...hm.map((row) => ({ row, quotation: row.hmQuotation.quotation })),
      ...cargo.map((row) => ({
        row,
        quotation: row.cargoQuotation.quotation,
      })),
    ];

    const candidates: Candidate[] = [];
    for (const { row, quotation } of rows) {
      candidates.push({
        sourceId: row.id,
        dueDate: row.dueDate!,
        title: 'Installment segera jatuh tempo',
        message: `Installment ${row.installmentNo} quotation ${quotation.quotationNumber} jatuh tempo ${formatDate(row.dueDate!)}.`,
        referenceType: 'QUOTATION',
        referenceId: quotation.id,
        recipientIds: await this.quotationRecipients(
          quotation.id,
          quotation.createdById,
        ),
      });
    }
    return candidates;
  }

  private async followUps(now: Date): Promise<Candidate[]> {
    const { start, end } = reminderWindow(
      now,
      getReminderDays('FOLLOW_UP_DUE'),
    );
    const followUps = await this.prisma.followUp.findMany({
      where: {
        deletedAt: null,
        status: 'OPEN',
        assigneeId: { not: null },
        dueDate: { gte: start, lte: end },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        entityType: true,
        entityId: true,
        meetingId: true,
      },
    });

    return followUps.map((followUp) => ({
      sourceId: followUp.id,
      dueDate: followUp.dueDate!,
      title: 'Follow-up segera jatuh tempo',
      message: `Follow-up "${followUp.title}" jatuh tempo ${formatDate(followUp.dueDate!)}.`,
      referenceType:
        followUp.entityType ?? (followUp.meetingId ? 'MEETING' : 'FOLLOW_UP'),
      referenceId: followUp.entityId ?? followUp.meetingId ?? followUp.id,
      recipientIds: [followUp.assigneeId!],
    }));
  }

  /** Active internal PICs of the vessel, else everyone allowed to edit vessels. */
  private async vesselRecipients(vesselId: string) {
    const pics = await this.activePicUserIds('VESSEL', vesselId);
    if (pics.length > 0) return pics;
    return usersWithPermission(this.prisma, 'vessel', 'update');
  }

  /** Active internal PICs of the quotation, else its creator. */
  private async quotationRecipients(
    quotationId: string,
    createdById: string | null,
  ) {
    const pics = await this.activePicUserIds('QUOTATION', quotationId);
    if (pics.length > 0) return pics;
    return createdById ? [createdById] : [];
  }

  private async activePicUserIds(
    entityType: 'VESSEL' | 'QUOTATION',
    entityId: string,
  ) {
    const now = new Date();
    const assignments = await this.prisma.assignment.findMany({
      where: {
        entityType,
        entityId,
        category: 'INTERNAL',
        deletedAt: null,
        userId: { not: null },
        user: { deletedAt: null },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      select: { userId: true },
    });
    return assignments.map((assignment) => assignment.userId!);
  }
}
