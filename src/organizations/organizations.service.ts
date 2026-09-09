import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  AssignPermissionsDto,
  CreateOrgDto,
  CreatePermissionDto,
  UpdateOrgDto,
  UpdatePermissionDto,
} from './organizations.validation';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.organizationUnit.findMany({
      where: { parentId: null, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { users: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const org = await this.prisma.organizationUnit.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, type: true },
        },
        _count: { select: { users: true } },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(dto: CreateOrgDto, actor: { id: string; fullname: string }) {
    if (dto.type === 'DEPARTMENT') {
      if (!dto.parentId)
        throw new BadRequestException('DEPARTMENT requires a parent DIVISION');
      const parent = await this.prisma.organizationUnit.findFirst({
        where: { id: dto.parentId, type: 'DIVISION', deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Parent DIVISION not found');
    }

    if (dto.type === 'DIVISION' && dto.parentId) {
      throw new BadRequestException('DIVISION must not have a parent');
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organizationUnit.create({
        data: {
          name: dto.name,
          type: dto.type,
          parentId: dto.parentId ?? null,
        },
        select: { id: true, name: true, type: true, parentId: true },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: org.id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} created organization ${org.name} (${org.type})`,
        },
      });

      return org;
    });
  }

  async update(
    id: string,
    dto: UpdateOrgDto,
    actor: { id: string; fullname: string },
  ) {
    const existing = await this.prisma.organizationUnit.findFirst({
      where: { id, deletedAt: null },
      include: {
        children: { where: { deletedAt: null }, select: { id: true } },
      },
    });

    if (!existing) throw new NotFoundException('Organization not found');

    if (dto.type === 'DEPARTMENT' && !dto.parentId && !existing.parentId) {
      throw new BadRequestException('DEPARTMENT requires a parent DIVISION');
    }

    if (dto.type === 'DIVISION' && (dto.parentId ?? existing.parentId)) {
      if (dto.parentId)
        throw new BadRequestException('DIVISION must not have a parent');
      if (existing.parentId && existing.children.length > 0) {
        throw new BadRequestException(
          'Cannot change a DIVISION with children to DEPARTMENT',
        );
      }
    }

    if (
      dto.parentId &&
      dto.parentId !== existing.parentId &&
      dto.type !== 'DIVISION'
    ) {
      const parent = await this.prisma.organizationUnit.findFirst({
        where: { id: dto.parentId, type: 'DIVISION', deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Parent DIVISION not found');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.type) updateData.type = dto.type;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organizationUnit.update({
        where: { id },
        data: updateData,
        select: { id: true, name: true, type: true, parentId: true },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} updated organization ${org.name}`,
        },
      });

      return org;
    });
  }

  async delete(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.organizationUnit.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Organization not found');

    const [childrenCount, usersCount] = await Promise.all([
      this.prisma.organizationUnit.count({
        where: { parentId: id, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { organizationUnitId: id, deletedAt: null },
      }),
    ]);

    if (childrenCount > 0) {
      throw new BadRequestException(
        'Cannot delete organization with active children. Remove or reassign them first.',
      );
    }

    if (usersCount > 0) {
      throw new BadRequestException(
        'Cannot delete organization with active users. Reassign them first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.organizationUnit.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} deleted organization ${existing.name}`,
        },
      });

      return { id };
    });
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async getPermission(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
    });

    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async createPermission(
    dto: CreatePermissionDto,
    actor: { id: string; fullname: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const permission = await tx.permission
        .create({
          data: {
            resource: dto.resource,
            action: dto.action,
            description: dto.description ?? null,
          },
          select: { id: true, resource: true, action: true, description: true },
        })
        .catch((err) => {
          if (err.code === 'P2002') {
            throw new BadRequestException(
              `Permission ${dto.resource}:${dto.action} already exists`,
            );
          }
          throw err;
        });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: permission.id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} created permission ${permission.resource}:${permission.action}`,
        },
      });

      return permission;
    });
  }

  async updatePermission(
    id: string,
    dto: UpdatePermissionDto,
    actor: { id: string; fullname: string },
  ) {
    const existing = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Permission not found');

    return this.prisma.$transaction(async (tx) => {
      const permission = await tx.permission.update({
        where: { id },
        data: { description: dto.description ?? null },
        select: { id: true, resource: true, action: true, description: true },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} updated permission ${existing.resource}:${existing.action}`,
        },
      });

      return permission;
    });
  }

  async deletePermission(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Permission not found');

    const assignments = await this.prisma.organizationUnitPermission.findMany({
      where: { permissionId: id },
      take: 1,
    });

    if (assignments.length > 0) {
      throw new BadRequestException(
        'Cannot delete permission that is assigned to organizations. Remove all assignments first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.permission.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'USER_MANAGEMENT',
          userId: actor.id,
          description: `${actor.fullname} deleted permission ${existing.resource}:${existing.action}`,
        },
      });

      return { id };
    });
  }

  async getOrgPermissions(orgId: string) {
    const org = await this.prisma.organizationUnit.findFirst({
      where: { id: orgId, deletedAt: null },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const assignments = await this.prisma.organizationUnitPermission.findMany({
      where: { organizationUnitId: orgId },
      select: {
        permission: {
          select: { id: true, resource: true, action: true },
        },
      },
    });

    return assignments.map((a) => a.permission);
  }

  async assignPermissions(
    orgId: string,
    dto: AssignPermissionsDto,
    actor: { id: string; fullname: string },
  ) {
    const org = await this.prisma.organizationUnit.findFirst({
      where: { id: orgId, deletedAt: null },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const existingPermissionIds = (
      await this.prisma.organizationUnitPermission.findMany({
        where: { organizationUnitId: orgId },
        select: { permissionId: true },
      })
    ).map((p) => p.permissionId);

    const newIds = dto.permissionIds.filter(
      (id) => !existingPermissionIds.includes(id),
    );

    if (newIds.length === 0) {
      return { assigned: 0 };
    }

    await this.prisma.organizationUnitPermission.createMany({
      data: newIds.map((permissionId) => ({
        organizationUnitId: orgId,
        permissionId,
      })),
      skipDuplicates: true,
    });

    await this.prisma.log.create({
      data: {
        action: 'CREATE',
        referenceType: 'USER_MANAGEMENT',
        referenceId: orgId,
        userId: actor.id,
        description: `${actor.fullname} assigned ${newIds.length} permission(s) to ${org.name}`,
      },
    });

    return { assigned: newIds.length };
  }

  async removePermission(
    orgId: string,
    permissionId: string,
    actor: { id: string; fullname: string },
  ) {
    const org = await this.prisma.organizationUnit.findFirst({
      where: { id: orgId, deletedAt: null },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const assignment = await this.prisma.organizationUnitPermission.findUnique({
      where: {
        organizationUnitId_permissionId: {
          organizationUnitId: orgId,
          permissionId,
        },
      },
    });

    if (!assignment)
      throw new NotFoundException('Permission assignment not found');

    await this.prisma.organizationUnitPermission.delete({
      where: {
        organizationUnitId_permissionId: {
          organizationUnitId: orgId,
          permissionId,
        },
      },
    });

    await this.prisma.log.create({
      data: {
        action: 'DELETE',
        referenceType: 'USER_MANAGEMENT',
        referenceId: orgId,
        userId: actor.id,
        description: `${actor.fullname} removed permission from ${org.name}`,
      },
    });

    return { id: permissionId };
  }
}
