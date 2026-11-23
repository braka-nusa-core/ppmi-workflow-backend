import { ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClientsService } from '../../src/clients/clients.service';
import { PrismaService } from '../../src/common/services/prisma.service';
import { QuotationTermVersionsService } from '../../src/quotations/quotation-term-versions.service';
import { QuotationsService } from '../../src/quotations/quotations.service';
import { TechnicalQuotationValidationService } from '../../src/quotations/technical-quotation-validation.service';
import {
  createUser,
  ensureTechnicalUnits,
  integrationEnabled,
  suffix,
} from './helpers';

describe.skipIf(!integrationEnabled)('quotation workflow (database)', () => {
  let prisma: PrismaService;
  let quotations: QuotationsService;
  let versions: QuotationTermVersionsService;
  let technician: { id: string; fullname: string };
  let supervisor: { id: string; fullname: string };
  let ids: {
    clientId: string;
    insuranceTypeId: string;
    insuranceCompanyId: string;
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    quotations = new QuotationsService(
      prisma,
      new ClientsService(prisma),
      new TechnicalQuotationValidationService(prisma),
    );
    versions = new QuotationTermVersionsService(prisma);

    const units = await ensureTechnicalUnits(prisma);
    const tech = await createUser(prisma, { organizationUnitId: units.pni.id });
    const spv = await createUser(prisma, {
      organizationUnitId: units.supervisor.id,
    });
    technician = { id: tech.id, fullname: tech.fullname };
    supervisor = { id: spv.id, fullname: spv.fullname };

    const client = await prisma.client.create({
      data: { clientCode: `IT-${suffix()}`, name: 'Integration Client' },
    });
    const type = await prisma.insuranceType.create({
      data: { code: `IT${suffix()}`, name: 'Integration type' },
    });
    const company = await prisma.insuranceCompany.create({
      data: { code: `IC${suffix()}`, name: 'Integration insurer' },
    });
    ids = {
      clientId: client.id,
      insuranceTypeId: type.id,
      insuranceCompanyId: company.id,
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const create = () =>
    quotations.create(
      { clientId: ids.clientId, insuranceTypeId: ids.insuranceTypeId },
      technician,
    );

  it('runs a quotation from DRAFT through insurer revision and back', async () => {
    const quotation = await create();
    expect(quotation.status).toBe('DRAFT');
    expect(quotation.technicalUnitId).not.toBeNull();

    await quotations.submit(quotation.id, technician);
    await quotations.approve(quotation.id, supervisor);

    // A change between submit and send shows up as a new terms version.
    await prisma.quotationTerm.create({
      data: { quotationId: quotation.id, description: 'Added after approval' },
    });
    const sent = await quotations.sendToInsurance(quotation.id, technician, {
      insuranceCompanyId: ids.insuranceCompanyId,
      note: 'to underwriting',
    });
    expect(sent.status).toBe('SENT_TO_INSURANCE');
    expect(sent.submissionId).toBeTruthy();

    await quotations.insuranceRevision(quotation.id, supervisor, {
      note: 'fix clause',
    });

    // Resubmitting is refused until the quotation was edited after the revision.
    await expect(quotations.submit(quotation.id, technician)).rejects.toThrow(
      'Edit the quotation after the insurer revision',
    );
    await quotations.update(
      quotation.id,
      { insured: 'PT Corrected' },
      technician,
    );
    // Versions are skipped when the terms did not change, so change them.
    await prisma.quotationTerm.create({
      data: { quotationId: quotation.id, description: 'Added during revision' },
    });
    await quotations.submit(quotation.id, technician);
    await quotations.approve(quotation.id, supervisor);

    const final = await prisma.quotation.findUniqueOrThrow({
      where: { id: quotation.id },
    });
    expect(final.status).toBe('APPROVED');
    expect(final.insured).toBe('PT Corrected');

    const history = await prisma.quotationHistory.findMany({
      where: { quotationId: quotation.id },
      orderBy: { createdAt: 'asc' },
    });
    // Sorted: rows written in the same millisecond have no guaranteed order.
    expect(history.map((row) => row.action).sort()).toEqual(
      [
        'CREATE',
        'SUBMIT',
        'APPROVE',
        'SEND_TO_INSURANCE',
        'INSURANCE_REVISION',
        'RESUBMIT_FOR_APPROVAL',
        'APPROVE',
      ].sort(),
    );

    const saved = await versions.list(quotation.id);
    expect(
      [...saved].sort((a, b) => a.version - b.version).map((v) => v.reason),
    ).toEqual(['SUBMIT', 'SEND_TO_INSURANCE', 'RESUBMIT_AFTER_REVISION']);
  });

  it('keeps the submission snapshot even after the quotation changes', async () => {
    const quotation = await create();
    await quotations.update(quotation.id, { insured: 'PT Before' }, technician);
    await quotations.submit(quotation.id, technician);
    await quotations.approve(quotation.id, supervisor);
    await quotations.sendToInsurance(quotation.id, technician, {
      insuranceCompanyId: ids.insuranceCompanyId,
    });

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { insured: 'PT After' },
    });

    const submission = await prisma.quotationSubmission.findFirstOrThrow({
      where: { quotationId: quotation.id },
    });
    expect((submission.snapshot as { insured?: string }).insured).toBe(
      'PT Before',
    );
  });

  it('does not let the technician approve their own quotation', async () => {
    const quotation = await create();
    await quotations.submit(quotation.id, technician);

    await expect(quotations.approve(quotation.id, technician)).rejects.toThrow(
      ForbiddenException,
    );
    const stored = await prisma.quotation.findUniqueOrThrow({
      where: { id: quotation.id },
    });
    expect(stored.status).toBe('WAITING_APPROVAL');
  });

  it('refuses edits once the quotation left DRAFT or REVISION', async () => {
    const quotation = await create();
    await quotations.submit(quotation.id, technician);

    await expect(
      quotations.update(quotation.id, { insured: 'x' }, technician),
    ).rejects.toThrow('Can only edit quotation in DRAFT or REVISION status');
  });

  it('enforces one terms version number per quotation in the database', async () => {
    const quotation = await create();
    const saved = await versions.create(quotation.id, 'first', technician);

    await expect(
      prisma.quotationTermVersion.create({
        data: {
          quotationId: quotation.id,
          version: saved.version,
          reason: 'MANUAL',
          terms: [],
        },
      }),
    ).rejects.toThrow();
  });
});
