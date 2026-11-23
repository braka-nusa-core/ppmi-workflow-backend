import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QsTemplatesService } from './qs-templates.service';
import {
  createQsTemplateSchema,
  updateQsTemplateSchema,
} from './qs-templates.validation';

describe('QsTemplatesService', () => {
  const prismaMock = {
    club: { findFirst: vi.fn() },
    qsTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const actor = { id: 'user-1', fullname: 'User Test' };
  let service: QsTemplatesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    service = new QsTemplatesService(prismaMock as any);
  });

  it('lists templates filtered by domain, club, and cover type without content', async () => {
    prismaMock.qsTemplate.findMany.mockResolvedValue([]);
    prismaMock.qsTemplate.count.mockResolvedValue(0);

    await service.list({
      templateDomain: 'PNI',
      clubId: 'club-1',
      coverType: 'LIMITED',
      page: 1,
      limit: 50,
    });

    const args = prismaMock.qsTemplate.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      deletedAt: null,
      templateDomain: 'PNI',
      clubId: 'club-1',
      coverType: 'LIMITED',
    });
    expect('content' in args.select).toBe(false);
  });

  it('rejects an unknown club', async () => {
    prismaMock.club.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        { name: 'MSIG Full', templateDomain: 'PNI', clubId: 'missing' },
        actor,
      ),
    ).rejects.toThrow('Club not found');
    expect(prismaMock.qsTemplate.create).not.toHaveBeenCalled();
  });

  it('creates a P&I template for a club and cover type, and logs it', async () => {
    prismaMock.club.findFirst.mockResolvedValue({ id: 'club-1' });
    prismaMock.qsTemplate.create.mockResolvedValue({
      id: 't-1',
      name: 'MSIG Full',
    });

    await service.create(
      {
        name: 'MSIG Full',
        templateDomain: 'PNI',
        clubId: 'club-1',
        coverType: 'FULL',
        content: { conditions: [] },
      },
      actor,
    );

    expect(prismaMock.qsTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clubId: 'club-1',
          coverType: 'FULL',
          content: { conditions: [] },
        }),
      }),
    );
    expect(prismaMock.log.create).toHaveBeenCalled();
  });

  it('refuses club or cover type on a non-P&I template update', async () => {
    prismaMock.qsTemplate.findFirst.mockResolvedValue({
      id: 't-1',
      name: 'Cargo',
      templateDomain: 'CARGO',
    });

    await expect(
      service.update('t-1', { coverType: 'FULL' }, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('clears the content with null', async () => {
    prismaMock.qsTemplate.findFirst.mockResolvedValue({
      id: 't-1',
      name: 'MSIG',
      templateDomain: 'PNI',
    });
    prismaMock.qsTemplate.update.mockResolvedValue({ id: 't-1', name: 'MSIG' });

    await service.update('t-1', { content: null }, actor);

    const data = prismaMock.qsTemplate.update.mock.calls[0][0].data;
    expect(data.content).toBeDefined();
    expect(data.content).not.toBeNull();
  });

  it('soft deletes and rejects an unknown template', async () => {
    prismaMock.qsTemplate.findFirst.mockResolvedValueOnce(null);
    await expect(service.delete('missing', actor)).rejects.toThrow(
      NotFoundException,
    );

    prismaMock.qsTemplate.findFirst.mockResolvedValueOnce({
      id: 't-1',
      name: 'MSIG',
    });
    await expect(service.delete('t-1', actor)).resolves.toEqual({ id: 't-1' });
    expect(prismaMock.qsTemplate.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('QS template schemas', () => {
  it('needs a club for P&I and refuses club or cover type elsewhere', () => {
    expect(() =>
      createQsTemplateSchema.parse({ name: 'x', templateDomain: 'PNI' }),
    ).toThrow();
    expect(() =>
      createQsTemplateSchema.parse({
        name: 'x',
        templateDomain: 'CARGO',
        coverType: 'FULL',
      }),
    ).toThrow();
    expect(
      createQsTemplateSchema.parse({ name: 'x', templateDomain: 'CARGO' })
        .templateDomain,
    ).toBe('CARGO');
  });

  it('needs at least one field on update', () => {
    expect(() => updateQsTemplateSchema.parse({})).toThrow();
  });
});
