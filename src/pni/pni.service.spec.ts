import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../common/services/prisma.service';
import { PniService } from './pni.service';

describe('PniService', () => {
  let service: PniService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PniService,
        { provide: PrismaService, useValue: {} },
        { provide: ClientsService, useValue: {} },
      ],
    }).compile();

    service = module.get<PniService>(PniService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('vessel master link', () => {
    const master = {
      id: 'vessel-1',
      name: 'BUANA HARBOUR 3201',
      imoNumber: '9876543',
      vesselType: 'HARBOUR TUG',
      builtYear: 2018,
      flag: 'Indonesia',
      vesselClass: 'BKI',
      classNotApplicable: false,
      grossTonnage: 354,
      portOfRegistry: 'Jakarta',
    };

    const makeTx = (found: unknown) => ({
      vessel: { findFirst: vi.fn().mockResolvedValue(found) },
      pniVessel: {
        create: vi.fn().mockResolvedValue({ id: 'pni-vessel-1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'pni-vessel-1' }),
        update: vi.fn().mockResolvedValue({ id: 'pni-vessel-1' }),
      },
    });

    const apply = (tx: unknown, vessels: unknown[]) =>
      (service as any).applyChildren(tx, 'pni-1', { vessels });

    it('fills blank snapshot fields from the master vessel on create', async () => {
      const tx = makeTx(master);

      await apply(tx, [{ vesselId: 'vessel-1', flag: 'Singapore' }]);

      expect(tx.pniVessel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pniQuotationId: 'pni-1',
          vesselId: 'vessel-1',
          name: 'BUANA HARBOUR 3201',
          imoNumber: '9876543',
          builtYear: 2018,
          flag: 'Singapore',
          grossTonnage: 354,
        }),
      });
    });

    it('rejects a vesselId that does not exist or was deleted', async () => {
      const tx = makeTx(null);

      await expect(apply(tx, [{ vesselId: 'missing' }])).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.pniVessel.create).not.toHaveBeenCalled();
    });

    it('keeps working without a vesselId', async () => {
      const tx = makeTx(null);

      await apply(tx, [{ name: 'Free Text Vessel' }]);

      expect(tx.vessel.findFirst).not.toHaveBeenCalled();
      expect(tx.pniVessel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Free Text Vessel' }),
      });
    });

    it('does not overwrite the snapshot from the master on update', async () => {
      const tx = makeTx(master);

      await apply(tx, [{ id: 'pni-vessel-1', vesselId: 'vessel-1' }]);

      const data = tx.pniVessel.update.mock.calls[0][0].data;
      expect(data.vesselId).toBe('vessel-1');
      expect(data.name).toBeUndefined();
      expect(data.flag).toBeUndefined();
    });
  });
});
