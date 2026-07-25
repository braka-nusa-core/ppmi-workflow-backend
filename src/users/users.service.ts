import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { hashPassword } from '../utils/bcrypt.util';
import { CreateUserDto, UpdateUserDto } from './users.validation';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationUnitId?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (organizationUnitId) {
      where.organizationUnitId = organizationUnitId;
    }

    return this.prisma.user.findMany({
      where: {
        ...where,
        role: { not: 'SUPERADMIN' },
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        role: true,
        organizationUnit: {
          select: {
            name: true,
            type: true,
            parent: { select: { name: true, type: true } },
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        role: true,
        organizationUnit: {
          select: {
            name: true,
            type: true,
            parent: { select: { name: true, type: true } },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actor: { id: string; fullname: string }) {
    const password = await hashPassword(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullname: dto.fullname,
          email: dto.email,
          password,
          phone: dto.phone,
          role: dto.role ?? 'USER',
          organizationUnitId: dto.organizationUnitId,
        },
        select: { id: true, fullname: true, email: true },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: user.id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} created user ${user.fullname} (${user.email})`,
        },
      });

      return user;
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: { id: string; fullname: string },
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== existing.email) {
      const duplicate = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (duplicate) throw new BadRequestException('Email already in use');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.fullname) updateData.fullname = dto.fullname;
    if (dto.email) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.role) updateData.role = dto.role;
    if (dto.organizationUnitId !== undefined)
      updateData.organizationUnitId = dto.organizationUnitId;
    if (dto.password) updateData.password = await hashPassword(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: updateData,
        select: { id: true, fullname: true, email: true },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} updated user ${user.fullname}`,
        },
      });

      return user;
    });
  }

  async delete(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullname: true, email: true },
    });

    if (!existing) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} deleted user ${existing.fullname} (${existing.email})`,
        },
      });

      return { id };
    });
  }
}
