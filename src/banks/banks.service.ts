import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateBankDto,
  ListBanksQuery,
  UpdateBankDto,
} from './banks.validation';

type Actor = { id: string; fullname: string };

@Injectable()
export class BanksService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListBanksQuery) {
    return this.prisma.bank.findMany({
      where: {
        deletedAt: null,
        ...(query.currency && { currency: query.currency }),
        ...(query.q && {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { accountName: { contains: query.q, mode: 'insensitive' } },
            { accountNumber: { contains: query.q, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
  }

  get(id: string) {
    return this.findBank(id);
  }

  async create(dto: CreateBankDto, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const bank = await tx.bank.create({ data: dto });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: bank.id,
          referenceType: 'BANK',
          userId: actor.id,
          description: `${actor.fullname} created bank ${bank.name}`,
        },
      });

      return bank;
    });
  }

  async update(id: string, dto: UpdateBankDto, actor: Actor) {
    await this.findBank(id);

    return this.prisma.$transaction(async (tx) => {
      const bank = await tx.bank.update({ where: { id }, data: dto });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'BANK',
          userId: actor.id,
          description: `${actor.fullname} updated bank ${bank.name}`,
        },
      });

      return bank;
    });
  }

  async delete(id: string, actor: Actor) {
    const bank = await this.findBank(id);

    const used = await this.prisma.invoice.count({
      where: { bankId: id, deletedAt: null },
    });
    if (used > 0) {
      throw new BadRequestException(
        'Bank is used by an invoice and cannot be deleted',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bank.update({ where: { id }, data: { deletedAt: new Date() } });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'BANK',
          userId: actor.id,
          description: `${actor.fullname} deleted bank ${bank.name}`,
        },
      });

      return { id };
    });
  }

  private async findBank(id: string) {
    const bank = await this.prisma.bank.findFirst({
      where: { id, deletedAt: null },
    });
    if (!bank) throw new NotFoundException('Bank not found');
    return bank;
  }
}
