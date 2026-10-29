import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateClubDto, UpdateClubDto } from './clubs.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.club.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
  }

  async get(id: string) {
    const club = await this.prisma.club.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!club) throw new NotFoundException('Club not found');
    return club;
  }

  async create(dto: CreateClubDto, actor: Actor) {
    await this.assertCodeAvailable(dto.code);

    return this.prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: { code: dto.code, name: dto.name },
        select: { id: true, code: true, name: true },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: club.id,
          referenceType: 'CLUB',
          userId: actor.id,
          description: `${actor.fullname} created club ${club.name} (${club.code})`,
        },
      });

      return club;
    });
  }

  async update(id: string, dto: UpdateClubDto, actor: Actor) {
    const existing = await this.prisma.club.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!existing) throw new NotFoundException('Club not found');

    if (dto.code !== undefined && dto.code !== existing.code) {
      await this.assertNotInUse(id);
      await this.assertCodeAvailable(dto.code);
    }

    return this.prisma.$transaction(async (tx) => {
      const club = await tx.club.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.name !== undefined && { name: dto.name }),
        },
        select: { id: true, code: true, name: true },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'CLUB',
          userId: actor.id,
          description: `${actor.fullname} updated club ${club.name} (${club.code})`,
        },
      });

      return club;
    });
  }

  async delete(id: string, actor: Actor) {
    const existing = await this.prisma.club.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    if (!existing) throw new NotFoundException('Club not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.club.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'CLUB',
          userId: actor.id,
          description: `${actor.fullname} deleted club ${existing.name} (${existing.code})`,
        },
      });

      return { id };
    });
  }

  async restore(id: string, actor: Actor) {
    const existing = await this.prisma.club.findFirst({
      where: { id, deletedAt: { not: null } },
      select: { id: true, name: true, code: true },
    });
    if (!existing) throw new NotFoundException('Inactive club not found');

    return this.prisma.$transaction(async (tx) => {
      const club = await tx.club.update({
        where: { id },
        data: { deletedAt: null },
        select: { id: true, code: true, name: true },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'CLUB',
          userId: actor.id,
          description: `${actor.fullname} restored club ${existing.name} (${existing.code})`,
        },
      });

      return club;
    });
  }

  private async assertCodeAvailable(code: string) {
    const taken = await this.prisma.club.findFirst({
      where: { code },
      select: { id: true },
    });
    if (taken) throw new BadRequestException('Club code already exists');
  }

  private async assertNotInUse(id: string) {
    const [quotations, templates] = await Promise.all([
      this.prisma.pniQuotation.count({ where: { clubId: id } }),
      this.prisma.qsTemplate.count({ where: { clubId: id } }),
    ]);
    if (quotations > 0 || templates > 0) {
      throw new BadRequestException(
        'Club code cannot be changed after it is in use',
      );
    }
  }
}
