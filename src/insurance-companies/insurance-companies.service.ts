import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateInsuranceCompanyDto,
  ListInsuranceCompaniesQuery,
  UpdateInsuranceCompanyDto,
} from './insurance-companies.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class InsuranceCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListInsuranceCompaniesQuery) {
    const where = {
      deletedAt: null,
      ...(query.q && {
        OR: [
          { code: { contains: query.q, mode: 'insensitive' as const } },
          { name: { contains: query.q, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.insuranceCompany.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.insuranceCompany.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  get(id: string) {
    return this.findCompany(id);
  }

  async create(dto: CreateInsuranceCompanyDto, actor: Actor) {
    await this.assertCodeAvailable(dto.code);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.insuranceCompany.create({
        data: {
          code: dto.code,
          name: dto.name,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          contactPerson: dto.contactPerson,
          status: dto.status,
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: company.id,
          referenceType: 'INSURANCE_COMPANY',
          userId: actor.id,
          description: `${actor.fullname} created insurance company ${company.code} - ${company.name}`,
        },
      });

      return company;
    });
  }

  async update(id: string, dto: UpdateInsuranceCompanyDto, actor: Actor) {
    const existing = await this.findCompany(id);
    if (dto.code !== undefined && dto.code !== existing.code) {
      await this.assertCodeAvailable(dto.code, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.insuranceCompany.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.contactPerson !== undefined && {
            contactPerson: dto.contactPerson,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'INSURANCE_COMPANY',
          userId: actor.id,
          description: `${actor.fullname} updated insurance company ${company.code} - ${company.name}`,
        },
      });

      return company;
    });
  }

  async delete(id: string, actor: Actor) {
    const existing = await this.findCompany(id);

    const used = await this.prisma.policyParticipant.count({
      where: { insuranceCompanyId: id, deletedAt: null },
    });
    if (used > 0) {
      throw new BadRequestException(
        'Insurance company is used in a placement and cannot be deleted',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.insuranceCompany.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'INSURANCE_COMPANY',
          userId: actor.id,
          description: `${actor.fullname} deleted insurance company ${existing.code} - ${existing.name}`,
        },
      });

      return { id };
    });
  }

  private async findCompany(id: string) {
    const company = await this.prisma.insuranceCompany.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Insurance company not found');
    return company;
  }

  private async assertCodeAvailable(code: string, excludeId?: string) {
    // The column is unique, so a soft-deleted row still holds its code.
    const duplicate = await this.prisma.insuranceCompany.findFirst({
      where: { code, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true, deletedAt: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        duplicate.deletedAt
          ? 'Insurance company code belongs to a deleted company'
          : 'Insurance company code already exists',
      );
    }
  }
}
