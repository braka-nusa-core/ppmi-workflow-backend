import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingsService } from './meetings.service';
import {
  createFollowUpSchema,
  createMeetingSchema,
} from './meetings.validation';

describe('MeetingsService', () => {
  const prismaMock = {
    vessel: { findFirst: vi.fn() },
    quotation: { findFirst: vi.fn() },
    policy: { findFirst: vi.fn() },
    client: { findFirst: vi.fn() },
    user: { count: vi.fn() },
    meeting: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    followUp: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  let service: MeetingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.user.count.mockResolvedValue(1);
    service = new MeetingsService(prismaMock as any);
  });

  describe('createMeeting', () => {
    it('rejects a meeting linked to an entity that does not exist', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);

      await expect(
        service.createMeeting(
          {
            title: 'Review',
            meetingDate: new Date(),
            entityType: 'VESSEL',
            entityId: 'v-9',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.meeting.create).not.toHaveBeenCalled();
    });

    it('creates follow-ups with the meeting and links them to the same entity', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({ id: 'v-1' });
      prismaMock.meeting.create.mockResolvedValue({
        id: 'm-1',
        title: 'Review',
      });

      await service.createMeeting(
        {
          title: 'Review',
          meetingDate: new Date('2026-11-17'),
          entityType: 'VESSEL',
          entityId: 'v-1',
          followUps: [{ title: 'Send survey report', assigneeId: 'user-2' }],
        },
        actor,
      );

      const data = prismaMock.meeting.create.mock.calls[0][0].data;
      expect(data.createdById).toBe('user-1');
      expect(data.followUps.create).toEqual([
        expect.objectContaining({
          title: 'Send survey report',
          assigneeId: 'user-2',
          entityType: 'VESSEL',
          entityId: 'v-1',
        }),
      ]);
      expect(prismaMock.log.create).toHaveBeenCalled();
    });

    it('rejects an unknown follow-up assignee', async () => {
      prismaMock.user.count.mockResolvedValue(0);

      await expect(
        service.createMeeting(
          {
            title: 'Review',
            meetingDate: new Date(),
            followUps: [{ title: 'x', assigneeId: 'ghost' }],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMeeting', () => {
    it('soft deletes the meeting together with its follow-ups', async () => {
      prismaMock.meeting.findFirst.mockResolvedValue({
        id: 'm-1',
        title: 'Review',
      });

      await service.deleteMeeting('m-1', actor);

      expect(prismaMock.followUp.updateMany).toHaveBeenCalledWith({
        where: { meetingId: 'm-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prismaMock.meeting.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('follow-ups', () => {
    it('rejects a follow-up for a meeting that does not exist', async () => {
      prismaMock.meeting.findFirst.mockResolvedValue(null);

      await expect(
        service.createFollowUp({ title: 'x', meetingId: 'm-9' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('stamps completedAt when a follow-up is marked DONE', async () => {
      prismaMock.followUp.findFirst.mockResolvedValue({
        id: 'f-1',
        title: 'x',
        status: 'OPEN',
      });
      prismaMock.followUp.update.mockResolvedValue({ id: 'f-1', title: 'x' });

      await service.updateFollowUp('f-1', { status: 'DONE' }, actor);

      const data = prismaMock.followUp.update.mock.calls[0][0].data;
      expect(data.status).toBe('DONE');
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when a follow-up is reopened', async () => {
      prismaMock.followUp.findFirst.mockResolvedValue({
        id: 'f-1',
        title: 'x',
        status: 'DONE',
      });
      prismaMock.followUp.update.mockResolvedValue({ id: 'f-1', title: 'x' });

      await service.updateFollowUp('f-1', { status: 'OPEN' }, actor);

      expect(
        prismaMock.followUp.update.mock.calls[0][0].data.completedAt,
      ).toBeNull();
    });

    it('leaves completedAt alone when the status does not change', async () => {
      prismaMock.followUp.findFirst.mockResolvedValue({
        id: 'f-1',
        title: 'x',
        status: 'DONE',
      });
      prismaMock.followUp.update.mockResolvedValue({ id: 'f-1', title: 'x' });

      await service.updateFollowUp('f-1', { title: 'renamed' }, actor);

      expect(
        'completedAt' in prismaMock.followUp.update.mock.calls[0][0].data,
      ).toBe(false);
    });

    it('filters the list by assignee, status and due date', async () => {
      prismaMock.followUp.findMany.mockResolvedValue([]);
      prismaMock.followUp.count.mockResolvedValue(0);
      const dueBefore = new Date('2026-12-01');

      await service.listFollowUps({
        page: 1,
        limit: 50,
        assigneeId: 'user-1',
        status: 'OPEN',
        dueBefore,
      });

      expect(prismaMock.followUp.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        assigneeId: 'user-1',
        status: 'OPEN',
        dueDate: { lte: dueBefore },
      });
    });
  });
});

describe('meeting schemas', () => {
  it('requires entityType and entityId together', () => {
    expect(() =>
      createMeetingSchema.parse({
        title: 'Review',
        meetingDate: '2026-11-17',
        entityType: 'VESSEL',
      }),
    ).toThrow();
    expect(() =>
      createFollowUpSchema.parse({ title: 'x', entityId: 'v-1' }),
    ).toThrow();
  });

  it('parses the meeting date and nested follow-ups', () => {
    const meeting = createMeetingSchema.parse({
      title: 'Review',
      meetingDate: '2026-11-17',
      followUps: [{ title: 'Send report', dueDate: '2026-11-24' }],
    });

    expect(meeting.meetingDate).toBeInstanceOf(Date);
    expect(meeting.followUps?.[0]?.dueDate).toBeInstanceOf(Date);
  });
});
