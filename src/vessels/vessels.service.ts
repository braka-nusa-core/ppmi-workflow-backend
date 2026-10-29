import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { normalizeName, vesselIdentityKey } from './vessel.util';
import {
  CreateVesselDto,
  ListVesselsQuery,
  UpdateVesselDto,
} from './vessels.validation';

type Actor = { id: string; fullname: string };

const vesselSelect = {
  id: true,
  name: true,
  normalizedName: true,
  vesselType: true,
  builtYear: true,
  grossTonnage: true,
  vesselClass: true,
} as const;

@Injectable()
export class VesselsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListVesselsQuery) {
    const where = {
      deletedAt: null,
      ...(query.q && { normalizedName: { contains: normalizeName(query.q) } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.vessel.findMany({
        where,
        select: vesselSelect,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vessel.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...vesselSelect,
        policies: {
          where: { deletedAt: null },
          orderBy: { periodStart: 'desc' },
          select: {
            id: true,
            clientId: true,
            policyNumber: true,
            periodStart: true,
            periodEnd: true,
            clubCode: true,
            status: true,
          },
        },
      },
    });
    if (!vessel) throw new NotFoundException('Vessel not found');
    return vessel;
  }

  async create(dto: CreateVesselDto, actor: Actor) {
    const normalizedName = normalizeName(dto.name);
    const identityKey = vesselIdentityKey(
      normalizedName,
      dto.builtYear,
      dto.grossTonnage,
    );
    await this.assertIdentityAvailable(identityKey);

    return this.prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.create({
        data: {
          name: dto.name.trim(),
          normalizedName,
          identityKey,
          vesselType: dto.vesselType,
          builtYear: dto.builtYear,
          grossTonnage: dto.grossTonnage,
          vesselClass: dto.vesselClass,
        },
        select: vesselSelect,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: vessel.id,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} created vessel ${vessel.name}`,
        },
      });

      return vessel;
    });
  }

  async update(id: string, dto: UpdateVesselDto, actor: Actor) {
    const existing = await this.prisma.vessel.findFirst({
      where: { id, deletedAt: null },
      select: {
        name: true,
        builtYear: true,
        grossTonnage: true,
        identityKey: true,
      },
    });
    if (!existing) throw new NotFoundException('Vessel not found');

    const name = dto.name ?? existing.name;
    const builtYear =
      dto.builtYear !== undefined ? dto.builtYear : existing.builtYear;
    const grossTonnage =
      dto.grossTonnage !== undefined
        ? dto.grossTonnage
        : existing.grossTonnage?.toString();

    const normalizedName = normalizeName(name);
    const identityKey = vesselIdentityKey(
      normalizedName,
      builtYear,
      grossTonnage,
    );
    if (identityKey !== existing.identityKey) {
      await this.assertIdentityAvailable(identityKey, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.update({
        where: { id },
        data: {
          name: name.trim(),
          normalizedName,
          identityKey,
          ...(dto.vesselType !== undefined && { vesselType: dto.vesselType }),
          ...(dto.builtYear !== undefined && { builtYear: dto.builtYear }),
          ...(dto.grossTonnage !== undefined && {
            grossTonnage: dto.grossTonnage,
          }),
          ...(dto.vesselClass !== undefined && {
            vesselClass: dto.vesselClass,
          }),
        },
        select: vesselSelect,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} updated vessel ${vessel.name}`,
        },
      });

      return vessel;
    });
  }

  async delete(id: string, actor: Actor) {
    const existing = await this.prisma.vessel.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException('Vessel not found');

    const activePolicies = await this.prisma.vesselPolicy.count({
      where: { vesselId: id, deletedAt: null },
    });
    if (activePolicies > 0) {
      throw new BadRequestException(
        'Vessel still has active policies and cannot be deleted',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.vessel.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'VESSEL',
          userId: actor.id,
          description: `${actor.fullname} deleted vessel ${existing.name}`,
        },
      });

      return { id };
    });
  }

  private async assertIdentityAvailable(identityKey: string, exceptId?: string) {
    const taken = await this.prisma.vessel.findFirst({
      where: { identityKey, ...(exceptId && { NOT: { id: exceptId } }) },
      select: { id: true },
    });
    if (taken) {
      throw new BadRequestException(
        'A vessel with the same name, build year, and GRT already exists',
      );
    }
  }
}
