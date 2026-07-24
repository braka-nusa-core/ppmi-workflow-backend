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

  async list(organization_unit_id?: string) {
    const where: Record<string, unknown> = { deleted_at: null };
    if (organization_unit_id) {
      where.organization_unit_id = organization_unit_id;
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
        organization_unit: {
          select: {
            name: true,
            type: true,
            parent: { select: { name: true, type: true } },
          },
        },
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        role: true,
        organization_unit: {
          select: {
            name: true,
            type: true,
            parent: { select: { name: true, type: true } },
          },
        },
        created_at: true,
        updated_at: true,
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
          organization_unit_id: dto.organization_unit_id,
        },
        select: { id: true, fullname: true, email: true },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          reference_id: user.id,
          reference_type: 'USER_MANAGEMENT',
          user_id: actor.id,
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
      where: { id, deleted_at: null },
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
    if (dto.organization_unit_id !== undefined)
      updateData.organization_unit_id = dto.organization_unit_id;
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
          reference_id: id,
          reference_type: 'USER_MANAGEMENT',
          user_id: actor.id,
          description: `${actor.fullname} updated user ${user.fullname}`,
        },
      });

      return user;
    });
  }

  async delete(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, fullname: true, email: true },
    });

    if (!existing) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deleted_at: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          reference_id: id,
          reference_type: 'USER_MANAGEMENT',
          user_id: actor.id,
          description: `${actor.fullname} deleted user ${existing.fullname} (${existing.email})`,
        },
      });

      return { message: `User ${existing.fullname} has been deleted` };
    });
  }
}
