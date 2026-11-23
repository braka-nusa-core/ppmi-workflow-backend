import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import { assertEntityExists } from '../common/utils/entity-reference';
import {
  CreateFollowUpDto,
  CreateMeetingDto,
  ListFollowUpsQuery,
  ListMeetingsQuery,
  UpdateFollowUpDto,
  UpdateMeetingDto,
} from './meetings.validation';

type Actor = { id: string; fullname: string };

const followUpInclude = {
  assignee: { select: { id: true, fullname: true } },
} as const;

const meetingInclude = {
  followUps: {
    where: { deletedAt: null },
    include: followUpInclude,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.MeetingInclude;

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Meetings ----------------------------------------------------------

  async listMeetings(query: ListMeetingsQuery) {
    const where = {
      deletedAt: null,
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...((query.from || query.to) && {
        meetingDate: {
          ...(query.from && { gte: query.from }),
          ...(query.to && { lte: query.to }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.meeting.findMany({
        where,
        include: meetingInclude,
        orderBy: { meetingDate: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.meeting.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getMeeting(id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, deletedAt: null },
      include: meetingInclude,
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async createMeeting(dto: CreateMeetingDto, actor: Actor) {
    if (dto.entityType && dto.entityId) {
      await assertEntityExists(this.prisma, dto.entityType, dto.entityId);
    }
    await this.assertAssignees(dto.followUps?.map((f) => f.assigneeId));

    return this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          title: dto.title,
          meetingDate: dto.meetingDate,
          location: dto.location,
          participants: dto.participants,
          agenda: dto.agenda,
          outcome: dto.outcome,
          entityType: dto.entityType,
          entityId: dto.entityId,
          createdById: actor.id,
          followUps: {
            create: (dto.followUps ?? []).map((followUp) => ({
              title: followUp.title,
              description: followUp.description,
              assigneeId: followUp.assigneeId,
              dueDate: followUp.dueDate,
              // A follow-up born in a meeting points at the same entity.
              entityType: dto.entityType,
              entityId: dto.entityId,
              createdById: actor.id,
            })),
          },
        },
        include: meetingInclude,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: meeting.id,
          referenceType: 'MEETING',
          userId: actor.id,
          description: `${actor.fullname} recorded meeting "${meeting.title}"`,
        },
      });

      return meeting;
    });
  }

  async updateMeeting(id: string, dto: UpdateMeetingDto, actor: Actor) {
    await this.getMeeting(id);

    return this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.meetingDate !== undefined && {
            meetingDate: dto.meetingDate,
          }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.participants !== undefined && {
            participants: dto.participants,
          }),
          ...(dto.agenda !== undefined && { agenda: dto.agenda }),
          ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        },
        include: meetingInclude,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'MEETING',
          userId: actor.id,
          description: `${actor.fullname} updated meeting "${meeting.title}"`,
        },
      });

      return meeting;
    });
  }

  async deleteMeeting(id: string, actor: Actor) {
    const meeting = await this.getMeeting(id);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.followUp.updateMany({
        where: { meetingId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.meeting.update({ where: { id }, data: { deletedAt: now } });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'MEETING',
          userId: actor.id,
          description: `${actor.fullname} deleted meeting "${meeting.title}"`,
        },
      });

      return { id };
    });
  }

  // ---- Follow-ups --------------------------------------------------------

  async listFollowUps(query: ListFollowUpsQuery) {
    const where = {
      deletedAt: null,
      ...(query.meetingId && { meetingId: query.meetingId }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.assigneeId && { assigneeId: query.assigneeId }),
      ...(query.status && { status: query.status }),
      ...(query.dueBefore && { dueDate: { lte: query.dueBefore } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.followUp.findMany({
        where,
        include: followUpInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.followUp.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getFollowUp(id: string) {
    const followUp = await this.prisma.followUp.findFirst({
      where: { id, deletedAt: null },
      include: followUpInclude,
    });
    if (!followUp) throw new NotFoundException('Follow-up not found');
    return followUp;
  }

  async createFollowUp(dto: CreateFollowUpDto, actor: Actor) {
    if (dto.meetingId) await this.getMeeting(dto.meetingId);
    if (dto.entityType && dto.entityId) {
      await assertEntityExists(this.prisma, dto.entityType, dto.entityId);
    }
    await this.assertAssignees([dto.assigneeId]);

    return this.prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.create({
        data: {
          meetingId: dto.meetingId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          title: dto.title,
          description: dto.description,
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate,
          createdById: actor.id,
        },
        include: followUpInclude,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: followUp.id,
          referenceType: 'FOLLOW_UP',
          userId: actor.id,
          description: `${actor.fullname} created follow-up "${followUp.title}"`,
        },
      });

      return followUp;
    });
  }

  async updateFollowUp(id: string, dto: UpdateFollowUpDto, actor: Actor) {
    const existing = await this.getFollowUp(id);
    await this.assertAssignees([dto.assigneeId ?? undefined]);

    const completion =
      dto.status === undefined || dto.status === existing.status
        ? {}
        : { completedAt: dto.status === 'DONE' ? new Date() : null };

    return this.prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...completion,
        },
        include: followUpInclude,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'FOLLOW_UP',
          userId: actor.id,
          description: `${actor.fullname} updated follow-up "${followUp.title}"${dto.status ? ` (${existing.status} -> ${dto.status})` : ''}`,
        },
      });

      return followUp;
    });
  }

  async deleteFollowUp(id: string, actor: Actor) {
    const followUp = await this.getFollowUp(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.followUp.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'FOLLOW_UP',
          userId: actor.id,
          description: `${actor.fullname} deleted follow-up "${followUp.title}"`,
        },
      });

      return { id };
    });
  }

  private async assertAssignees(ids: (string | undefined)[] | undefined) {
    const unique = [...new Set((ids ?? []).filter((id): id is string => !!id))];
    if (unique.length === 0) return;

    const found = await this.prisma.user.count({
      where: { id: { in: unique }, deletedAt: null },
    });
    if (found !== unique.length) {
      throw new BadRequestException('Assignee not found');
    }
  }
}
