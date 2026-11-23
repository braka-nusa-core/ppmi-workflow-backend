import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQsOptionDto,
  ListQsOptionsQuery,
  UpdateQsOptionDto,
} from './qs-options.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class QsOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListQsOptionsQuery) {
    return this.prisma.qsOption.findMany({
      where: { group: query.group, isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    });
  }

  listAll(query: Partial<ListQsOptionsQuery>) {
    return this.prisma.qsOption.findMany({
      where: { deletedAt: null, ...(query.group && { group: query.group }) },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { value: 'asc' }],
    });
  }

  async create(dto: CreateQsOptionDto, actor: Actor) {
    await this.assertValueAvailable(dto.group, dto.value);

    return this.prisma.$transaction(async (tx) => {
      const option = await tx.qsOption.create({
        data: {
          group: dto.group,
          value: dto.value,
          label: dto.label,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
        },
      });
      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: option.id,
          referenceType: 'QS_TEMPLATE',
          userId: actor.id,
          description: `${actor.fullname} created QSheet option ${option.group}/${option.value}`,
        },
      });
      return option;
    });
  }

  async update(id: string, dto: UpdateQsOptionDto, actor: Actor) {
    const existing = await this.findOption(id);
    if (dto.value !== undefined) {
      await this.assertValueAvailable(existing.group, dto.value, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const option = await tx.qsOption.update({
        where: { id },
        data: {
          ...(dto.value !== undefined && { value: dto.value }),
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'QS_TEMPLATE',
          userId: actor.id,
          description: `${actor.fullname} updated QSheet option ${option.group}/${option.value}`,
        },
      });
      return option;
    });
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.findOption(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.qsOption.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'QS_TEMPLATE',
          userId: actor.id,
          description: `${actor.fullname} deleted QSheet option ${existing.group}/${existing.value}`,
        },
      });
      return { id };
    });
  }

  private async findOption(id: string) {
    const option = await this.prisma.qsOption.findFirst({
      where: { id, deletedAt: null },
    });
    if (!option) throw new NotFoundException('QSheet option not found');
    return option;
  }

  // Case-insensitive uniqueness per group; the database has no such index.
  private async assertValueAvailable(
    group: string,
    value: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.qsOption.findFirst({
      where: {
        group,
        value: { equals: value, mode: 'insensitive' },
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'An option with this value already exists in the group',
      );
    }
  }
}
