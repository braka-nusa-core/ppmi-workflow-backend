import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getReminderDays } from '../notifications/reminder.config';
import { normalizeName } from './vessel.util';
import {
  CreateVesselRequirementDto,
  UpdateVesselRequirementDto,
} from './vessel-requirements.validation';

type Actor = { id: string; fullname: string };

export type ChecklistStatus = 'OK' | 'EXPIRING_SOON' | 'EXPIRED' | 'MISSING';

type Requirement = {
  id: string;
  category: string;
  label: string | null;
};

type DocumentRow = {
  id: string;
  category: string;
  status: string;
  validUntil: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compares the required categories with the documents a vessel has.
 * A document counts when it is not expired (by date or by status). Among the
 * valid ones, the one that lasts longest is reported, and a document without
 * an expiry date lasts forever.
 */
export function evaluateChecklist(
  requirements: Requirement[],
  documents: DocumentRow[],
  now: Date,
  soonDays: number,
) {
  const soonLimit = new Date(now.getTime() + soonDays * DAY_MS);

  const items = requirements.map((requirement) => {
    const ofCategory = documents.filter(
      (document) => document.category === requirement.category,
    );
    const valid = ofCategory.filter(
      (document) =>
        document.status !== 'EXPIRED' &&
        (!document.validUntil || document.validUntil >= now),
    );

    let status: ChecklistStatus;
    let best: DocumentRow | undefined;
    if (valid.length > 0) {
      best = valid.reduce((a, b) => {
        if (!a.validUntil) return a;
        if (!b.validUntil) return b;
        return b.validUntil > a.validUntil ? b : a;
      });
      status =
        best.validUntil && best.validUntil <= soonLimit
          ? 'EXPIRING_SOON'
          : 'OK';
    } else if (ofCategory.length > 0) {
      status = 'EXPIRED';
    } else {
      status = 'MISSING';
    }

    return {
      requirementId: requirement.id,
      category: requirement.category,
      label: requirement.label,
      status,
      documentId: best?.id ?? null,
      validUntil: best?.validUntil ?? null,
    };
  });

  const count = (status: ChecklistStatus) =>
    items.filter((item) => item.status === status).length;

  return {
    summary: {
      required: items.length,
      ok: count('OK'),
      expiringSoon: count('EXPIRING_SOON'),
      expired: count('EXPIRED'),
      missing: count('MISSING'),
      // Expiring soon still counts as complete: the document is valid today.
      complete: items.every(
        (item) => item.status === 'OK' || item.status === 'EXPIRING_SOON',
      ),
    },
    items,
  };
}

@Injectable()
export class VesselRequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.vesselDocumentRequirement.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }],
    });
  }

  async create(dto: CreateVesselRequirementDto, actor: Actor) {
    await this.assertNoDuplicate(dto.category, dto.vesselType ?? null);

    return this.prisma.$transaction(async (tx) => {
      const requirement = await tx.vesselDocumentRequirement.create({
        data: {
          category: dto.category,
          label: dto.label,
          vesselType: dto.vesselType,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: requirement.id,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} added required vessel document ${requirement.category}`,
        },
      });

      return requirement;
    });
  }

  async update(id: string, dto: UpdateVesselRequirementDto, actor: Actor) {
    const existing = await this.find(id);

    const category = dto.category ?? existing.category;
    const vesselType =
      dto.vesselType !== undefined ? dto.vesselType : existing.vesselType;
    if (category !== existing.category || vesselType !== existing.vesselType) {
      await this.assertNoDuplicate(category, vesselType, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const requirement = await tx.vesselDocumentRequirement.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.vesselType !== undefined && { vesselType: dto.vesselType }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} updated required vessel document ${requirement.category}`,
        },
      });

      return requirement;
    });
  }

  async delete(id: string, actor: Actor) {
    const existing = await this.find(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.vesselDocumentRequirement.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} removed required vessel document ${existing.category}`,
        },
      });

      return { id };
    });
  }

  /** What a vessel has and what it still lacks, per required category. */
  async checklist(vesselId: string, now = new Date()) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { id: vesselId, deletedAt: null },
      select: { id: true, name: true, vesselType: true },
    });
    if (!vessel) throw new NotFoundException('Vessel not found');

    const vesselType = vessel.vesselType
      ? normalizeName(vessel.vesselType)
      : null;
    const requirements = (
      await this.prisma.vesselDocumentRequirement.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }],
      })
    ).filter(
      (requirement) =>
        !requirement.vesselType ||
        normalizeName(requirement.vesselType) === vesselType,
    );

    const documents =
      requirements.length === 0
        ? []
        : await this.prisma.vesselDocument.findMany({
            where: {
              vesselId,
              deletedAt: null,
              category: { in: requirements.map((item) => item.category) },
            },
            select: {
              id: true,
              category: true,
              status: true,
              validUntil: true,
            },
          });

    return {
      vesselId: vessel.id,
      vesselName: vessel.name,
      ...evaluateChecklist(
        requirements,
        documents,
        now,
        getReminderDays('VESSEL_DOCUMENT_EXPIRING'),
      ),
    };
  }

  private async find(id: string) {
    const requirement = await this.prisma.vesselDocumentRequirement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');
    return requirement;
  }

  // The database cannot enforce this: a unique index treats two NULL vessel
  // types as different, and the vessel type is compared ignoring case.
  private async assertNoDuplicate(
    category: string,
    vesselType: string | null,
    exceptId?: string,
  ) {
    const sameCategory = await this.prisma.vesselDocumentRequirement.findMany({
      where: {
        category,
        deletedAt: null,
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { vesselType: true },
    });
    const wanted = vesselType ? normalizeName(vesselType) : null;
    const duplicate = sameCategory.some((row) => {
      const existing = row.vesselType ? normalizeName(row.vesselType) : null;
      return existing === wanted;
    });
    if (duplicate) {
      throw new BadRequestException(
        'This category is already required for the same vessel type',
      );
    }
  }
}
