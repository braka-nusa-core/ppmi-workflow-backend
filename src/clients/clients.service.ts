import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateClientDto, UpdateClientDto } from './clients.validation';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async generateClientCode(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `CLT-${y}${m}${d}-`;

    const last = await this.prisma.client.findFirst({
      where: { clientCode: { startsWith: prefix } },
      orderBy: { clientCode: 'desc' },
      select: { clientCode: true },
    });

    let seq = 1;
    if (last) {
      seq = parseInt(last.clientCode.slice(-3), 10) + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async create(dto: CreateClientDto, actor: { id: string; fullname: string }) {
    const clientCode = await this.generateClientCode();

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          clientCode,
          name: dto.name,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          contactPerson: dto.contactPerson,
        },
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: client.id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} created client ${client.name} (${client.clientCode})`,
        },
      });

      return client;
    });
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    actor: { id: string; fullname: string },
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Client not found');

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && {
            name: dto.name,
          }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.contactPerson !== undefined && {
            contactPerson: dto.contactPerson,
          }),
        },
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} updated client ${client.name}`,
        },
      });

      return client;
    });
  }

  async delete(id: string, actor: { id: string; fullname: string }) {
    const existing = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, clientCode: true },
    });
    if (!existing) throw new NotFoundException('Client not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} deleted client ${existing.name} (${existing.clientCode})`,
        },
      });

      return { id };
    });
  }
}
