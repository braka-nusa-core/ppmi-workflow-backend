import { NotFoundException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronSecretGuard } from '../common/guards/cron-secret.guard';
import { NotificationsService } from './notifications.service';
import { getReminderDays, reminderWindow } from './reminder.config';
import { RemindersService } from './reminders.service';

describe('reminder config', () => {
  it('defaults to 7 days and honours per-type and global overrides', () => {
    expect(getReminderDays('INSTALLMENT_DUE', {})).toBe(7);
    expect(
      getReminderDays('INSTALLMENT_DUE', { REMINDER_DAYS_BEFORE: '3' }),
    ).toBe(3);
    expect(
      getReminderDays('INSTALLMENT_DUE', {
        REMINDER_DAYS_BEFORE: '3',
        REMINDER_DAYS_INSTALLMENT_DUE: '14',
      }),
    ).toBe(14);
    expect(
      getReminderDays('INSTALLMENT_DUE', { REMINDER_DAYS_BEFORE: 'abc' }),
    ).toBe(7);
  });

  it('builds a UTC window covering the whole last day', () => {
    const { start, end } = reminderWindow(new Date('2026-11-17T15:30:00Z'), 7);

    expect(start.toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-24T23:59:59.999Z');
  });
});

describe('CronSecretGuard', () => {
  const guard = new CronSecretGuard();
  const contextWith = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('rejects everything when no secret is configured', () => {
    expect(guard.canActivate(contextWith('Bearer anything'))).toBe(false);
  });

  it('accepts only the exact bearer secret', () => {
    process.env.CRON_SECRET = 's3cret';

    expect(guard.canActivate(contextWith('Bearer s3cret'))).toBe(true);
    expect(guard.canActivate(contextWith('Bearer wrong!'))).toBe(false);
    expect(guard.canActivate(contextWith('s3cret'))).toBe(false);
    expect(guard.canActivate(contextWith(undefined))).toBe(false);
  });
});

describe('NotificationsService', () => {
  const prismaMock = {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(prismaMock as any);
  });

  it('only lets a user read their own notification', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('user-1', 'n-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'n-1', recipientId: 'user-1' },
      select: { id: true, isRead: true },
    });
  });

  it('creates notifications while skipping duplicates', async () => {
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 });

    const created = await service.createMany([
      {
        recipientId: 'user-1',
        title: 't',
        message: 'm',
        type: 'X',
        dedupeKey: 'k',
      },
    ]);

    expect(created).toBe(1);
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });
});

describe('RemindersService', () => {
  const emptyList = () => vi.fn().mockResolvedValue([]);
  const prismaMock = {
    vesselDocument: { findMany: emptyList() },
    vesselSurvey: { findMany: emptyList() },
    pniInstallment: { findMany: emptyList() },
    hmQuotationInstallment: { findMany: emptyList() },
    cargoQuotationInstallment: { findMany: emptyList() },
    followUp: { findMany: emptyList() },
    assignment: { findMany: emptyList() },
    organizationUnit: { findMany: emptyList() },
    user: { findMany: emptyList() },
  };
  const notificationsMock = { createMany: vi.fn() };
  let service: RemindersService;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(prismaMock)) {
      model.findMany.mockResolvedValue([]);
    }
    notificationsMock.createMany.mockImplementation(
      async (items: unknown[]) => items.length,
    );
    service = new RemindersService(prismaMock as any, notificationsMock as any);
  });

  it('notifies the vessel PIC about an expiring document with a stable dedupe key', async () => {
    prismaMock.vesselDocument.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        vesselId: 'vessel-1',
        category: 'SURAT_LAUT',
        fileName: 'sl.pdf',
        validUntil: new Date('2026-11-20T00:00:00Z'),
        vessel: { name: 'KAIROS JAYA' },
      },
    ]);
    prismaMock.assignment.findMany.mockResolvedValue([
      { userId: 'pic-1' },
      { userId: 'pic-1' },
    ]);

    const result = await service.run(new Date('2026-11-17T08:00:00Z'));

    expect(result.created.VESSEL_DOCUMENT_EXPIRING).toBe(1);
    expect(notificationsMock.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: 'pic-1',
        type: 'VESSEL_DOCUMENT_EXPIRING',
        referenceType: 'VESSEL',
        referenceId: 'vessel-1',
        dedupeKey: 'VESSEL_DOCUMENT_EXPIRING:doc-1:2026-11-20:pic-1',
      }),
    ]);
  });

  it('falls back to users who can edit vessels when there is no PIC', async () => {
    prismaMock.vesselDocument.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        vesselId: 'vessel-1',
        category: 'PHOTO',
        fileName: 'a.jpg',
        validUntil: new Date('2026-11-20T00:00:00Z'),
        vessel: { name: 'KAIROS JAYA' },
      },
    ]);
    prismaMock.organizationUnit.findMany.mockResolvedValue([
      { id: 'unit-1', children: [{ id: 'unit-2' }] },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'u-2' },
    ]);

    await service.run(new Date('2026-11-17T08:00:00Z'));

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { role: 'SUPERADMIN' },
            { organizationUnitId: { in: ['unit-1', 'unit-2'] } },
          ],
        }),
      }),
    );
    const sent = notificationsMock.createMany.mock.calls[0][0];
    expect(sent.map((n: any) => n.recipientId)).toEqual(['admin-1', 'u-2']);
  });

  it('notifies the quotation creator about a due installment when there is no PIC', async () => {
    prismaMock.pniInstallment.findMany.mockResolvedValue([
      {
        id: 'inst-1',
        installmentNo: 2,
        dueDate: new Date('2026-11-18T00:00:00Z'),
        pniQuotation: {
          quotation: {
            id: 'q-1',
            quotationNumber: 'QS-001',
            createdById: 'creator-1',
          },
        },
      },
    ]);

    const result = await service.run(new Date('2026-11-17T08:00:00Z'));

    expect(result.created.INSTALLMENT_DUE).toBe(1);
    expect(notificationsMock.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: 'creator-1',
        referenceType: 'QUOTATION',
        referenceId: 'q-1',
      }),
    ]);
  });

  it('keeps running the other reminders when one source fails', async () => {
    prismaMock.vesselSurvey.findMany.mockRejectedValue(new Error('db down'));
    prismaMock.followUp.findMany.mockResolvedValue([
      {
        id: 'f-1',
        title: 'Kirim dokumen',
        dueDate: new Date('2026-11-18T00:00:00Z'),
        assigneeId: 'user-1',
        entityType: null,
        entityId: null,
        meetingId: null,
      },
    ]);

    const result = await service.run(new Date('2026-11-17T08:00:00Z'));

    expect(result.errors).toEqual([
      { type: 'VESSEL_SURVEY_EXPIRING', message: 'db down' },
    ]);
    expect(result.created.FOLLOW_UP_DUE).toBe(1);
  });
});
