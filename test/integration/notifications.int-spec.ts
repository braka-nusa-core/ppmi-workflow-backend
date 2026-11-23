import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/services/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { integrationEnabled, suffix } from './helpers';

describe.skipIf(!integrationEnabled)('notifications (database)', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService;

  beforeAll(() => {
    prisma = new PrismaService();
    notifications = new NotificationsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const reminder = (recipientId: string, key: string) => ({
    recipientId,
    title: 'Dokumen kapal segera kedaluwarsa',
    message: 'test',
    type: 'VESSEL_DOCUMENT_EXPIRING',
    referenceType: 'VESSEL',
    referenceId: 'vessel-x',
    dedupeKey: key,
  });

  it('never creates the same reminder twice', async () => {
    const recipient = `user-${suffix()}`;
    const key = `K:${suffix()}`;

    expect(await notifications.createMany([reminder(recipient, key)])).toBe(1);
    expect(await notifications.createMany([reminder(recipient, key)])).toBe(0);

    const stored = await prisma.notification.count({
      where: { dedupeKey: key },
    });
    expect(stored).toBe(1);
  });

  it('keeps the rest of a batch when one entry is a duplicate', async () => {
    const recipient = `user-${suffix()}`;
    const existing = `K:${suffix()}`;
    await notifications.createMany([reminder(recipient, existing)]);

    const created = await notifications.createMany([
      reminder(recipient, existing),
      reminder(recipient, `K:${suffix()}`),
    ]);

    expect(created).toBe(1);
  });

  it('lets a user read only their own notifications', async () => {
    const mine = `user-${suffix()}`;
    const other = `user-${suffix()}`;
    await notifications.createMany([
      reminder(mine, `K:${suffix()}`),
      reminder(other, `K:${suffix()}`),
    ]);

    const list = await notifications.list(mine, { page: 1, limit: 20 });
    expect(list.total).toBe(1);
    expect(list.items[0].recipientId).toBe(mine);

    const [first] = list.items;
    await notifications.markRead(mine, first.id);
    expect(await notifications.unreadCount(mine)).toEqual({ count: 0 });
    expect(await notifications.unreadCount(other)).toEqual({ count: 1 });
  });
});
