import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotationsService } from './quotations.service';

describe('QuotationsService workflow', () => {
  const prismaMock = {
    quotation: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    insuranceCompany: { findFirst: vi.fn() },
    quotationApproval: { create: vi.fn() },
    quotationSubmission: { findFirst: vi.fn(), create: vi.fn() },
    insuranceReview: { create: vi.fn() },
    quotationHistory: { create: vi.fn() },
    quotationTerm: { findMany: vi.fn() },
    quotationTermVersion: { findFirst: vi.fn(), create: vi.fn() },
    log: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const validationMock = { validateForSubmit: vi.fn() };

  const actor = { id: 'user-1', fullname: 'User Test' };
  const baseQuotation = {
    id: 'q-1',
    quotationNumber: 'QS-001',
    status: 'DRAFT',
    technicalUnitId: null as string | null,
    insurerRevisionRequestedAt: null as Date | null,
    insurerRevisionUpdatedAt: null as Date | null,
  };

  let service: QuotationsService;

  const quotationIs = (overrides: Partial<typeof baseQuotation>) =>
    prismaMock.quotation.findFirst.mockResolvedValue({
      ...baseQuotation,
      ...overrides,
    });

  const termVersionReasons = () =>
    prismaMock.quotationTermVersion.create.mock.calls.map(
      (call) => call[0].data.reason,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations, so a rejection set in one test
    // would leak into the next one.
    validationMock.validateForSubmit.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.quotation.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.quotationTerm.findMany.mockResolvedValue([]);
    prismaMock.quotationTermVersion.findFirst.mockResolvedValue(null);
    prismaMock.quotationTermVersion.create.mockImplementation(
      async (args) => args.data,
    );
    prismaMock.quotationSubmission.create.mockResolvedValue({ id: 'sub-1' });
    service = new QuotationsService(
      prismaMock as any,
      {} as any,
      validationMock as any,
    );
    vi.spyOn(service as any, 'getSubmissionSnapshot').mockResolvedValue({
      snapshot: true,
    });
  });

  describe('submit', () => {
    it('moves DRAFT to WAITING_APPROVAL, writes history, and saves terms version 1', async () => {
      quotationIs({ status: 'DRAFT' });

      const result = await service.submit('q-1', actor, { note: 'ready' });

      expect(validationMock.validateForSubmit).toHaveBeenCalledWith('q-1');
      expect(result).toMatchObject({ id: 'q-1', status: 'WAITING_APPROVAL' });
      expect(prismaMock.quotation.updateMany).toHaveBeenCalledWith({
        where: { id: 'q-1', deletedAt: null, status: 'DRAFT' },
        data: { status: 'WAITING_APPROVAL' },
      });
      expect(prismaMock.quotationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: 'DRAFT',
          toStatus: 'WAITING_APPROVAL',
          action: 'SUBMIT',
          note: 'ready',
        }),
      });
      expect(termVersionReasons()).toEqual(['SUBMIT']);
    });

    it('refuses to submit a quotation that is not editable', async () => {
      quotationIs({ status: 'APPROVED' });

      await expect(service.submit('q-1', actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.quotation.updateMany).not.toHaveBeenCalled();
    });

    it('does not submit when the type-specific gate fails', async () => {
      quotationIs({ status: 'DRAFT' });
      validationMock.validateForSubmit.mockRejectedValue(
        new BadRequestException('H&M quotation requires four instalments'),
      );

      await expect(service.submit('q-1', actor)).rejects.toThrow(
        'four instalments',
      );
      expect(prismaMock.quotation.updateMany).not.toHaveBeenCalled();
    });

    it('blocks resubmitting from REVISION until the quotation was edited', async () => {
      quotationIs({
        status: 'REVISION',
        insurerRevisionRequestedAt: new Date('2026-11-10T10:00:00Z'),
        insurerRevisionUpdatedAt: null,
      });

      await expect(service.submit('q-1', actor)).rejects.toThrow(
        'Edit the quotation after the insurer revision',
      );
      expect(prismaMock.quotation.updateMany).not.toHaveBeenCalled();
    });

    it('blocks resubmitting when the only edit happened before the revision request', async () => {
      quotationIs({
        status: 'REVISION',
        insurerRevisionRequestedAt: new Date('2026-11-10T10:00:00Z'),
        insurerRevisionUpdatedAt: new Date('2026-11-09T10:00:00Z'),
      });

      await expect(service.submit('q-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resubmits from REVISION after an edit and labels the terms version accordingly', async () => {
      quotationIs({
        status: 'REVISION',
        insurerRevisionRequestedAt: new Date('2026-11-10T10:00:00Z'),
        insurerRevisionUpdatedAt: new Date('2026-11-11T10:00:00Z'),
      });

      await service.submit('q-1', actor);

      expect(prismaMock.quotationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: 'REVISION',
          action: 'RESUBMIT_FOR_APPROVAL',
        }),
      });
      expect(termVersionReasons()).toEqual(['RESUBMIT_AFTER_REVISION']);
    });
  });

  describe('approve, reject, and request revision', () => {
    it('only lets a Supervisor Teknik or SUPERADMIN decide', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnit: {
          name: 'P&I',
          type: 'DEPARTMENT',
          deletedAt: null,
          parent: { name: 'Teknik', type: 'DIVISION', deletedAt: null },
        },
      });

      await expect(service.approve('q-1', actor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.quotation.updateMany).not.toHaveBeenCalled();
    });

    it('lets a Supervisor Teknik approve and records the approval', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnit: {
          name: 'Supervisor Teknik',
          type: 'DEPARTMENT',
          deletedAt: null,
          parent: { name: 'Teknik', type: 'DIVISION', deletedAt: null },
        },
      });
      quotationIs({ status: 'WAITING_APPROVAL' });

      await service.approve('q-1', actor, { note: 'ok' });

      expect(prismaMock.quotationApproval.create).toHaveBeenCalledWith({
        data: {
          quotationId: 'q-1',
          approverId: 'user-1',
          action: 'APPROVED',
          note: 'ok',
        },
      });
      expect(prismaMock.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: {
          approvedBy: { connect: { id: 'user-1' } },
          approvedAt: expect.any(Date),
        },
      });
      // APPROVED is not a terms-version trigger.
      expect(prismaMock.quotationTermVersion.create).not.toHaveBeenCalled();
    });

    it('lets SUPERADMIN reject a quotation back to DRAFT', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'SUPERADMIN',
        organizationUnit: null,
      });
      quotationIs({ status: 'WAITING_APPROVAL' });

      const result = await service.reject('q-1', actor);

      expect(result.status).toBe('DRAFT');
      expect(prismaMock.quotationApproval.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'REJECTED' }),
      });
    });

    it('cannot approve a quotation that was never submitted', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'SUPERADMIN',
        organizationUnit: null,
      });
      quotationIs({ status: 'DRAFT' });

      await expect(service.approve('q-1', actor)).rejects.toThrow(
        'Cannot transition from DRAFT to APPROVED',
      );
    });
  });

  describe('transition safety', () => {
    it('reports a concurrent change instead of overwriting it', async () => {
      quotationIs({ status: 'DRAFT' });
      prismaMock.quotation.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submit('q-1', actor)).rejects.toThrow(
        'changed concurrently',
      );
      expect(prismaMock.quotationHistory.create).not.toHaveBeenCalled();
    });

    it('fails the whole transition when the terms version cannot be saved', async () => {
      quotationIs({ status: 'DRAFT' });
      prismaMock.quotationTermVersion.create.mockRejectedValue(
        new Error('unique constraint'),
      );

      await expect(service.submit('q-1', actor)).rejects.toThrow(
        'unique constraint',
      );
      // The history row is written before the version, but both live in one
      // transaction, so the rejection is what rolls the status change back.
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown quotation', async () => {
      prismaMock.quotation.findFirst.mockResolvedValue(null);

      await expect(service.insuranceApprove('missing', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('send to insurance and insurer decisions', () => {
    beforeEach(() => {
      quotationIs({ status: 'APPROVED' });
    });

    it('refuses an unknown insurance company', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue(null);

      await expect(
        service.sendToInsurance('q-1', actor, { insuranceCompanyId: 'ic-9' }),
      ).rejects.toThrow('Insurance company not found');
      expect(prismaMock.quotationSubmission.create).not.toHaveBeenCalled();
    });

    it('stores an immutable snapshot, returns the submission id, and saves a terms version', async () => {
      prismaMock.insuranceCompany.findFirst.mockResolvedValue({ id: 'ic-1' });

      const result = await service.sendToInsurance('q-1', actor, {
        insuranceCompanyId: 'ic-1',
        note: 'to underwriting',
      });

      expect(result).toEqual({
        id: 'q-1',
        status: 'SENT_TO_INSURANCE',
        submissionId: 'sub-1',
      });
      expect(prismaMock.quotationSubmission.create).toHaveBeenCalledWith({
        data: {
          quotationId: 'q-1',
          insuranceCompanyId: 'ic-1',
          sentById: 'user-1',
          note: 'to underwriting',
          snapshot: { snapshot: true },
        },
      });
      expect(termVersionReasons()).toEqual(['SEND_TO_INSURANCE']);
    });

    it('only lets the owning technical unit send the quotation', async () => {
      quotationIs({ status: 'APPROVED', technicalUnitId: 'unit-pi' });
      prismaMock.user.findFirst.mockResolvedValue({
        role: 'USER',
        organizationUnitId: 'unit-hm',
      });

      await expect(
        service.sendToInsurance('q-1', actor, { insuranceCompanyId: 'ic-1' }),
      ).rejects.toThrow('belongs to another technical unit');
      expect(prismaMock.quotation.updateMany).not.toHaveBeenCalled();
    });

    it('needs a pending submission before recording an insurer decision', async () => {
      quotationIs({ status: 'SENT_TO_INSURANCE' });
      prismaMock.quotationSubmission.findFirst.mockResolvedValue(null);

      await expect(service.insuranceApprove('q-1', actor)).rejects.toThrow(
        'No pending insurance submission found',
      );
    });

    it('records an insurer approval on the pending submission', async () => {
      quotationIs({ status: 'SENT_TO_INSURANCE' });
      prismaMock.quotationSubmission.findFirst.mockResolvedValue({
        id: 'sub-1',
      });

      const result = await service.insuranceApprove('q-1', actor);

      expect(result.status).toBe('INSURANCE_APPROVED');
      expect(prismaMock.insuranceReview.create).toHaveBeenCalledWith({
        data: {
          quotationSubmissionId: 'sub-1',
          action: 'APPROVED',
          note: undefined,
          recordedById: 'user-1',
        },
      });
      expect(prismaMock.quotationTermVersion.create).not.toHaveBeenCalled();
    });

    it('stamps the revision request and clears the edit marker on an insurer revision', async () => {
      quotationIs({ status: 'SENT_TO_INSURANCE' });
      prismaMock.quotationSubmission.findFirst.mockResolvedValue({
        id: 'sub-1',
      });

      await service.insuranceRevision('q-1', actor, { note: 'fix clause' });

      expect(prismaMock.quotation.updateMany).toHaveBeenCalledWith({
        where: { id: 'q-1', deletedAt: null, status: 'SENT_TO_INSURANCE' },
        data: {
          status: 'REVISION',
          insurerRevisionRequestedAt: expect.any(Date),
          insurerRevisionUpdatedAt: null,
        },
      });
      expect(prismaMock.insuranceReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REVISION',
          note: 'fix clause',
        }),
      });
    });
  });

  describe('assertEditable', () => {
    it.each(['WAITING_APPROVAL', 'APPROVED', 'SENT_TO_INSURANCE'])(
      'rejects edits while the quotation is %s',
      async (status) => {
        quotationIs({ status });

        await expect(service.assertEditable('q-1', 'user-1')).rejects.toThrow(
          'Can only edit quotation in DRAFT or REVISION status',
        );
      },
    );

    it.each(['DRAFT', 'REVISION'])('allows edits in %s', async (status) => {
      quotationIs({ status });

      await expect(
        service.assertEditable('q-1', 'user-1'),
      ).resolves.toMatchObject({ id: 'q-1' });
    });

    it('rejects edits from another technical unit but not from SUPERADMIN', async () => {
      quotationIs({ status: 'DRAFT', technicalUnitId: 'unit-pi' });
      prismaMock.user.findFirst.mockResolvedValueOnce({
        role: 'USER',
        organizationUnitId: 'unit-hm',
      });
      await expect(service.assertEditable('q-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );

      prismaMock.user.findFirst.mockResolvedValueOnce({
        role: 'SUPERADMIN',
        organizationUnitId: null,
      });
      await expect(
        service.assertEditable('q-1', 'admin-1'),
      ).resolves.toBeDefined();
    });

    it('does not check ownership for legacy quotations without a unit', async () => {
      quotationIs({ status: 'DRAFT', technicalUnitId: null });

      await service.assertEditable('q-1', 'user-1');

      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('markInsurerRevisionUpdated', () => {
    it('only touches quotations that are in REVISION', async () => {
      await service.markInsurerRevisionUpdated('q-1');

      expect(prismaMock.quotation.updateMany).toHaveBeenCalledWith({
        where: { id: 'q-1', deletedAt: null, status: 'REVISION' },
        data: { insurerRevisionUpdatedAt: expect.any(Date) },
      });
    });
  });

  describe('exportPdf', () => {
    it('only exports an approved quotation', async () => {
      quotationIs({ status: 'DRAFT' });

      await expect(service.exportPdf('q-1', 'user-1')).rejects.toThrow(
        'Only an approved quotation can be exported',
      );
    });

    it('returns the placeholder for an approved quotation', async () => {
      quotationIs({ status: 'APPROVED' });

      await expect(service.exportPdf('q-1', 'user-1')).resolves.toMatchObject({
        message: 'PDF generation not yet implemented',
        quotationNumber: 'QS-001',
      });
    });
  });
});
