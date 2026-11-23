import { BadRequestException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/services/prisma.service';
import { VesselRequirementsService } from '../../src/vessels/vessel-requirements.service';
import { VesselsService } from '../../src/vessels/vessels.service';
import { createUser, integrationEnabled, suffix } from './helpers';

describe.skipIf(!integrationEnabled)('vessels (database)', () => {
  let prisma: PrismaService;
  let vessels: VesselsService;
  let requirements: VesselRequirementsService;
  let actor: { id: string; fullname: string };

  beforeAll(async () => {
    prisma = new PrismaService();
    vessels = new VesselsService(prisma);
    requirements = new VesselRequirementsService(prisma);
    const user = await createUser(prisma);
    actor = { id: user.id, fullname: user.fullname };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores and returns the master fields', async () => {
    const created = await vessels.create(
      {
        name: `IT VESSEL ${suffix()}`,
        builtYear: 2018,
        grossTonnage: 354,
        imoNumber: '9876543',
        flag: 'Indonesia',
        tradingArea: 'Indonesia',
        portOfRegistry: 'Jakarta',
      },
      actor,
    );

    const found = await vessels.get(created.id);
    expect(found).toMatchObject({
      imoNumber: '9876543',
      flag: 'Indonesia',
      tradingArea: 'Indonesia',
      portOfRegistry: 'Jakarta',
      classNotApplicable: false,
    });
  });

  it('keeps the identity when only master fields change', async () => {
    const created = await vessels.create(
      { name: `IT VESSEL ${suffix()}`, builtYear: 2010, grossTonnage: 100 },
      actor,
    );
    const before = await prisma.vessel.findUniqueOrThrow({
      where: { id: created.id },
    });

    await vessels.update(
      created.id,
      { imoNumber: '1234567', flag: 'SG' },
      actor,
    );

    const after = await prisma.vessel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.identityKey).toBe(before.identityKey);
    expect(after.imoNumber).toBe('1234567');
  });

  it('rejects a duplicate in the service and in the database', async () => {
    const name = `IT VESSEL ${suffix()}`;
    await vessels.create({ name, builtYear: 2001, grossTonnage: 50 }, actor);

    await expect(
      vessels.create(
        { name: name.toLowerCase(), builtYear: 2001, grossTonnage: 50 },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    // The unique index is the last line of defence if two requests race.
    const existing = await prisma.vessel.findFirstOrThrow({
      where: { name },
    });
    await expect(
      prisma.vessel.create({
        data: {
          name: 'copy',
          normalizedName: 'COPY',
          identityKey: existing.identityKey,
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses to delete a vessel that still has an active policy', async () => {
    const vessel = await vessels.create(
      { name: `IT VESSEL ${suffix()}` },
      actor,
    );
    const client = await prisma.client.create({
      data: { clientCode: `IT-${suffix()}`, name: 'Integration Client' },
    });
    const policy = await prisma.vesselPolicy.create({
      data: {
        vesselId: vessel.id,
        clientId: client.id,
        coverageKey: `it-${suffix()}`,
      },
    });

    await expect(vessels.delete(vessel.id, actor)).rejects.toThrow(
      BadRequestException,
    );

    await prisma.vesselPolicy.update({
      where: { id: policy.id },
      data: { deletedAt: new Date() },
    });
    await expect(vessels.delete(vessel.id, actor)).resolves.toEqual({
      id: vessel.id,
    });
  });

  it('builds a document checklist from required categories', async () => {
    const vesselType = `IT TYPE ${suffix()}`;
    const vessel = await vessels.create(
      { name: `IT VESSEL ${suffix()}`, vesselType },
      actor,
    );
    // Scoped to this vessel type. Requirements for "every vessel" may exist in
    // the test database, so look the item up by category instead of by position.
    const category = `IT_DOC_${suffix().toUpperCase()}`;
    await requirements.create({ category, vesselType }, actor);
    const itemOf = (result: {
      items: { category: string; status: string }[];
    }) => result.items.find((item) => item.category === category);

    const missing = await requirements.checklist(vessel.id);
    expect(itemOf(missing)?.status).toBe('MISSING');
    expect(missing.summary.complete).toBe(false);

    await prisma.vesselDocument.create({
      data: {
        vesselId: vessel.id,
        category,
        fileName: 'doc.pdf',
        fileUrl: 'https://example.test/doc.pdf',
      },
    });

    expect(itemOf(await requirements.checklist(vessel.id))?.status).toBe('OK');

    await prisma.vesselDocument.updateMany({
      where: { vesselId: vessel.id },
      data: { validUntil: new Date('2020-01-01') },
    });
    expect(itemOf(await requirements.checklist(vessel.id))?.status).toBe(
      'EXPIRED',
    );
  });
});
