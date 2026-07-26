import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateInsuranceTypeDto,
  UpdateInsuranceTypeDto,
} from './insurance-types.validation';

@Injectable()
export class InsuranceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.insuranceType.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const type = await this.prisma.insuranceType.findFirst({
      where: { id, deletedAt: null },
    });
    if (!type) throw new NotFoundException('Insurance type not found');
    return type;
  }

  async create(
    dto: CreateInsuranceTypeDto,
    actor: { id: string; fullname: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const type = await tx.insuranceType.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: type.id,
          referenceType: 'INSURANCE_TYPE',
          userId: actor.id,
          description: `${actor.fullname} created insurance type ${type.name} (${type.code})`,
        },
      });

      return type;
    });
  }

  async update(
    id: string,
    dto: UpdateInsuranceTypeDto,
    actor: { id: string; fullname: string },
  ) {
    const existing = await this.prisma.insuranceType.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Insurance type not found');

    return this.prisma.$transaction(async (tx) => {
      const type = await tx.insuranceType.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'INSURANCE_TYPE',
          userId: actor.id,
          description: `${actor.fullname} updated insurance type ${type.name}`,
        },
      });

      return type;
    });
  }

  async delete(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.insuranceType.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    if (!existing) throw new NotFoundException('Insurance type not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.insuranceType.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'INSURANCE_TYPE',
          userId: actor.id,
          description: `${actor.fullname} deleted insurance type ${existing.name} (${existing.code})`,
        },
      });

      return { id };
    });
  }
}
