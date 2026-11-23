import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

export type NewNotification = {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  referenceType?: string;
  referenceId?: string;
  dueDate?: Date;
  dedupeKey?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    recipientId: string,
    query: { unread?: boolean; page: number; limit: number },
  ) {
    const where = {
      recipientId,
      ...(query.unread && { isRead: false }),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async unreadCount(recipientId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId, isRead: false },
    });
    return { count };
  }

  async markRead(recipientId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, recipientId },
      select: { id: true, isRead: true },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.isRead) return { id };

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return { id };
  }

  async markAllRead(recipientId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * Creates notifications, silently skipping any whose dedupeKey already
   * exists. Returns how many were actually created.
   */
  async createMany(notifications: NewNotification[]) {
    if (notifications.length === 0) return 0;
    const result = await this.prisma.notification.createMany({
      data: notifications,
      skipDuplicates: true,
    });
    return result.count;
  }
}
