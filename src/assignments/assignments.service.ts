import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { assertEntityExists } from '../common/utils/entity-reference';
import {
  CreateAssignmentDto,
  ListAssignmentsQuery,
  UpdateAssignmentDto,
} from './assignments.validation';

type Actor = { id: string; fullname: string };

const assignmentInclude = {
  user: { select: { id: true, fullname: true, email: true } },
} as const;

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAssignmentsQuery) {
    const now = new Date();
    const where = {
      deletedAt: null,
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.userId && { userId: query.userId }),
      ...(query.category && { category: query.category }),
      // Ended assignments stay in the history but are hidden by default.
      ...(!query.includeEnded && {
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assignment.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    return this.findAssignment(id);
  }

  async create(dto: CreateAssignmentDto, actor: Actor) {
    await assertEntityExists(this.prisma, dto.entityType, dto.entityId);

    if (dto.category === 'INTERNAL') {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.userId, deletedAt: null },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('User not found');

      const duplicate = await this.prisma.assignment.findFirst({
        where: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          userId: dto.userId,
          role: dto.role ?? null,
          deletedAt: null,
          OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BadRequestException(
          'This user is already assigned with the same role',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          category: dto.category,
          userId: dto.userId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          organizationName: dto.organizationName,
          role: dto.role,
          note: dto.note,
          startDate: dto.startDate,
          createdById: actor.id,
        },
        include: assignmentInclude,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: assignment.id,
          referenceType: 'ASSIGNMENT',
          userId: actor.id,
          description: `${actor.fullname} assigned ${this.label(assignment)} (${dto.category}) to ${dto.entityType} ${dto.entityId}`,
        },
      });

      return assignment;
    });
  }

  async update(id: string, dto: UpdateAssignmentDto, actor: Actor) {
    const existing = await this.findAssignment(id);
    if (existing.category === 'INTERNAL' && dto.name !== undefined) {
      throw new BadRequestException(
        'An INTERNAL assignment takes its name from the user',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.organizationName !== undefined && {
            organizationName: dto.organizationName,
          }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.note !== undefined && { note: dto.note }),
        },
        include: assignmentInclude,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'ASSIGNMENT',
          userId: actor.id,
          description: `${actor.fullname} updated assignment of ${this.label(assignment)}`,
        },
      });

      return assignment;
    });
  }

  /** Ends the assignment. The record stays so the history is preserved. */
  async end(id: string, actor: Actor) {
    const existing = await this.findAssignment(id);
    const now = new Date();
    if (existing.endDate && existing.endDate <= now) return { id };

    return this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({ where: { id }, data: { endDate: now } });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'ASSIGNMENT',
          userId: actor.id,
          description: `${actor.fullname} ended assignment of ${this.label(existing)}`,
        },
      });

      return { id };
    });
  }

  private async findAssignment(id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, deletedAt: null },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  private label(assignment: {
    name: string | null;
    user?: { fullname: string } | null;
  }) {
    return assignment.user?.fullname ?? assignment.name ?? 'unknown';
  }
}
