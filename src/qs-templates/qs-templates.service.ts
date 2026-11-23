import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQsTemplateDto,
  ListQsTemplatesQuery,
  UpdateQsTemplateDto,
} from './qs-templates.validation';

type Actor = { id: string; fullname: string };

// Lists leave out `content`, which can be large; GET /qs-templates/:id has it.
const summarySelect = {
  id: true,
  name: true,
  templateVersion: true,
  templateDomain: true,
  clubId: true,
  coverType: true,
  createdAt: true,
  updatedAt: true,
  club: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class QsTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQsTemplatesQuery) {
    const where = {
      deletedAt: null,
      ...(query.templateDomain && { templateDomain: query.templateDomain }),
      ...(query.clubId && { clubId: query.clubId }),
      ...(query.coverType && { coverType: query.coverType }),
    };

    const [items, total] = await Promise.all([
      this.prisma.qsTemplate.findMany({
        where,
        select: summarySelect,
        orderBy: [{ templateDomain: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.qsTemplate.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const template = await this.prisma.qsTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { club: { select: { id: true, code: true, name: true } } },
    });
    if (!template) throw new NotFoundException('QS template not found');
    return template;
  }

  async create(dto: CreateQsTemplateDto, actor: Actor) {
    if (dto.clubId) await this.assertClub(dto.clubId);

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.qsTemplate.create({
        data: {
          name: dto.name,
          templateVersion: dto.templateVersion,
          templateDomain: dto.templateDomain,
          clubId: dto.clubId,
          coverType: dto.coverType,
          content: dto.content as Prisma.InputJsonValue | undefined,
        },
        select: summarySelect,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: template.id,
          referenceType: 'QS_TEMPLATE',
          userId: actor.id,
          description: `${actor.fullname} created QS template ${template.name}`,
        },
      });

      return template;
    });
  }

  async update(id: string, dto: UpdateQsTemplateDto, actor: Actor) {
    const existing = await this.get(id);
    const isPni = existing.templateDomain === 'PNI';
    if (!isPni && (dto.clubId !== undefined || dto.coverType)) {
      throw new BadRequestException(
        'clubId and coverType only apply to P&I templates',
      );
    }
    if (dto.clubId) await this.assertClub(dto.clubId);

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.qsTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.templateVersion !== undefined && {
            templateVersion: dto.templateVersion,
          }),
          ...(dto.clubId !== undefined && { clubId: dto.clubId }),
          ...(dto.coverType !== undefined && { coverType: dto.coverType }),
          ...(dto.content !== undefined && {
            content:
              dto.content === null
                ? Prisma.JsonNull
                : (dto.content as Prisma.InputJsonValue),
          }),
        },
        select: summarySelect,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'QS_TEMPLATE',
          userId: actor.id,
          description: `${actor.fullname} updated QS template ${template.name}`,
        },
      });

      return template;
    });
  }

  /**
   * Soft delete. Quotations already created from the template keep their
   * reference and their own copied data.
   */
  async delete(id: string, actor: Actor) {
    const existing = await this.get(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.qsTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'QS_TEMPLATE',
          userId: actor.id,
          description: `${actor.fullname} deleted QS template ${existing.name}`,
        },
      });

      return { id };
    });
  }

  private async assertClub(clubId: string) {
    const club = await this.prisma.club.findFirst({
      where: { id: clubId, deletedAt: null },
      select: { id: true },
    });
    if (!club) throw new BadRequestException('Club not found');
  }
}
