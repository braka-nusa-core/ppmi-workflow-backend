import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignmentsService } from './assignments.service';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from './assignments.validation';

describe('AssignmentsService', () => {
  const prismaMock = {
    vessel: { findFirst: vi.fn() },
    quotation: { findFirst: vi.fn() },
    policy: { findFirst: vi.fn() },
    client: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    assignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'admin-1', fullname: 'Admin' };
  let service: AssignmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    service = new AssignmentsService(prismaMock as any);
  });

  describe('create', () => {
    it('rejects an entity that does not exist', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            entityType: 'VESSEL',
            entityId: 'v-1',
            category: 'INTERNAL',
            userId: 'u-1',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.assignment.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown user for an INTERNAL assignment', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({ id: 'v-1' });
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            entityType: 'VESSEL',
            entityId: 'v-1',
            category: 'INTERNAL',
            userId: 'u-1',
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects assigning the same user with the same role twice', async () => {
      prismaMock.vessel.findFirst.mockResolvedValue({ id: 'v-1' });
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u-1' });
      prismaMock.assignment.findFirst.mockResolvedValue({ id: 'a-1' });

      await expect(
        service.create(
          {
            entityType: 'VESSEL',
            entityId: 'v-1',
            category: 'INTERNAL',
            userId: 'u-1',
            role: 'Underwriter',
          },
          actor,
        ),
      ).rejects.toThrow('already assigned');
    });

    it('stores an external PIC with contact details and logs it', async () => {
      prismaMock.client.findFirst.mockResolvedValue({ id: 'c-1' });
      prismaMock.assignment.create.mockResolvedValue({
        id: 'a-1',
        name: 'Budi',
        user: null,
      });

      await service.create(
        {
          entityType: 'CLIENT',
          entityId: 'c-1',
          category: 'EXTERNAL',
          name: 'Budi',
          phone: '0812',
        },
        actor,
      );

      expect(prismaMock.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'CLIENT',
            category: 'EXTERNAL',
            name: 'Budi',
            createdById: 'admin-1',
          }),
        }),
      );
      expect(prismaMock.log.create).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('hides ended assignments unless history is requested', async () => {
      prismaMock.assignment.findMany.mockResolvedValue([]);
      prismaMock.assignment.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 50, includeEnded: false });
      expect(
        prismaMock.assignment.findMany.mock.calls[0][0].where.OR,
      ).toBeDefined();

      await service.list({ page: 1, limit: 50, includeEnded: true });
      expect(
        prismaMock.assignment.findMany.mock.calls[1][0].where.OR,
      ).toBeUndefined();
    });
  });

  describe('end', () => {
    it('keeps the record and only sets endDate', async () => {
      prismaMock.assignment.findFirst.mockResolvedValue({
        id: 'a-1',
        name: null,
        endDate: null,
        user: { fullname: 'Sari' },
      });

      await service.end('a-1', actor);

      expect(prismaMock.assignment.update).toHaveBeenCalledWith({
        where: { id: 'a-1' },
        data: { endDate: expect.any(Date) },
      });
    });

    it('does nothing for an assignment that already ended', async () => {
      prismaMock.assignment.findFirst.mockResolvedValue({
        id: 'a-1',
        name: 'Budi',
        endDate: new Date('2020-01-01'),
        user: null,
      });

      await expect(service.end('a-1', actor)).resolves.toEqual({ id: 'a-1' });
      expect(prismaMock.assignment.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('does not let an INTERNAL assignment be renamed', async () => {
      prismaMock.assignment.findFirst.mockResolvedValue({
        id: 'a-1',
        category: 'INTERNAL',
        user: { fullname: 'Sari' },
      });

      await expect(
        service.update('a-1', { name: 'Other' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('assignment schemas', () => {
  it('requires userId for INTERNAL and name for the others', () => {
    expect(() =>
      createAssignmentSchema.parse({
        entityType: 'VESSEL',
        entityId: 'v-1',
        category: 'INTERNAL',
      }),
    ).toThrow();
    expect(() =>
      createAssignmentSchema.parse({
        entityType: 'VESSEL',
        entityId: 'v-1',
        category: 'INSURER',
      }),
    ).toThrow();
    expect(
      createAssignmentSchema.parse({
        entityType: 'VESSEL',
        entityId: 'v-1',
        category: 'INSURER',
        name: 'MSIG',
      }).name,
    ).toBe('MSIG');
  });

  it('refuses a userId on a non-internal assignment', () => {
    expect(() =>
      createAssignmentSchema.parse({
        entityType: 'VESSEL',
        entityId: 'v-1',
        category: 'EXTERNAL',
        name: 'Budi',
        userId: 'u-1',
      }),
    ).toThrow();
  });

  it('does not allow changing who is assigned on update', () => {
    const parsed = updateAssignmentSchema.parse({
      userId: 'u-2',
      role: 'Lead',
    });

    expect(parsed).toEqual({ role: 'Lead' });
  });
});
