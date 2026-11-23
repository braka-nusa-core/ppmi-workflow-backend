import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  PLACEMENT_TOTAL_HUNDREDTHS,
  toHundredths,
} from './policies.validation';

export type Actor = { id: string; fullname: string };

export const MAX_FILE_SIZE = 52_428_800;
export const ALLOWED_FILE_TYPES =
  /^(application\/pdf|image\/.+|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-.+)$/;

/**
 * Same rule as QuotationsService: a quotation without a technical unit stays
 * open to everyone with the permission, otherwise only that unit (or a
 * SUPERADMIN) may act on it.
 */
export async function assertTechnicalUnitOwnership(
  prisma: PrismaService,
  technicalUnitId: string | null,
  actorId: string,
) {
  if (!technicalUnitId) return;

  const actor = await prisma.user.findFirst({
    where: { id: actorId, deletedAt: null },
    select: { role: true, organizationUnitId: true },
  });
  if (!actor) throw new ForbiddenException('User is no longer active');
  if (
    actor.role !== 'SUPERADMIN' &&
    actor.organizationUnitId !== technicalUnitId
  ) {
    throw new ForbiddenException('Quotation belongs to another technical unit');
  }
}

export function summarizePlacement(
  participants: { role: string; share: { toString(): string } | number }[],
) {
  const totalHundredths = participants.reduce(
    (sum, item) => sum + toHundredths(item.share),
    0,
  );
  const leaders = participants.filter((item) => item.role === 'LEADER').length;
  return {
    totalShare: totalHundredths / 100,
    isComplete: leaders === 1 && totalHundredths === PLACEMENT_TOTAL_HUNDREDTHS,
  };
}

/**
 * Takes the row lock on the quotation for the rest of the transaction, so a
 * placement change and a placement completion on the same quotation run one
 * after the other instead of interleaving. Returns false when the quotation is
 * gone or no longer in one of `statuses`.
 */
export async function lockQuotation(
  tx: { quotation: { updateMany: (args: any) => Promise<{ count: number }> } },
  quotationId: string,
  statuses?: string[],
) {
  const result = await tx.quotation.updateMany({
    where: {
      id: quotationId,
      deletedAt: null,
      ...(statuses && { status: { in: statuses } }),
    },
    data: { updatedAt: new Date() },
  });
  return result.count === 1;
}
