import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateShipmentDto, UpdateShipmentDto } from './shipments.validation';

@Injectable()
export class ShipmentsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listShipments(filters: {
    invoice_id?: string | string[];
    search?: string | string[];
    page?: string | string[];
    limit?: string | string[];
    sort_by?: string | string[];
    sort_order?: string | string[];
  }) {
    const toSingleValue = (value?: string | string[]) => {
      if (!value) {
        return undefined;
      }

      if (Array.isArray(value)) {
        return value.map((item) => item.trim()).find(Boolean);
      }

      return value.trim();
    };

    const invoiceId = toSingleValue(filters.invoice_id);
    const searchTerm = toSingleValue(filters.search);
    const pageRaw = toSingleValue(filters.page);
    const limitRaw = toSingleValue(filters.limit);
    const sortByRaw = toSingleValue(filters.sort_by);
    const sortOrderRaw = toSingleValue(filters.sort_order);

    const page = pageRaw ? Number(pageRaw) : 1;
    const limit = limitRaw ? Number(limitRaw) : 10;

    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException('Invalid page');
    }

    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException('Invalid limit');
    }

    const sortBy = (sortByRaw ?? 'created_at').toLowerCase();
    const sortOrder = (sortOrderRaw ?? 'desc').toLowerCase();

    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
      throw new BadRequestException('Invalid sort_order');
    }

    const sortFieldMap: Record<
      string,
      keyof Prisma.DocumentShipmentOrderByWithRelationInput
    > = {
      id: 'id',
      courier: 'courier',
      tracking_number: 'tracking_number',
      shipping_date: 'shipping_date',
      created_at: 'created_at',
      updated_at: 'updated_at',
    };

    const sortField = sortFieldMap[sortBy];

    if (!sortField) {
      throw new BadRequestException('Invalid sort_by');
    }

    const AND: Prisma.DocumentShipmentWhereInput[] = [{ deleted_at: null }];

    if (invoiceId) {
      AND.push({ invoice_id: invoiceId });
    }

    if (searchTerm && searchTerm.length > 0) {
      AND.push({
        OR: [
          { courier: { contains: searchTerm, mode: 'insensitive' } },
          { tracking_number: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const orderBy: Prisma.DocumentShipmentOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.documentShipment.findMany({
        where: { AND },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          invoice: {
            select: {
              id: true,
              invoice_number: true,
            },
          },
          shipping_proof: {
            select: {
              id: true,
              file_name: true,
              file_url: true,
            },
          },
        },
      }),
      this.prismaService.documentShipment.count({ where: { AND } }),
    ]);

    return {
      items,
      total_pages: Math.ceil(total / limit),
      current_page: page,
    };
  }

  async getShipment(id: string) {
    const shipment = await this.prismaService.documentShipment.findFirst({
      where: { id, deleted_at: null },
      include: {
        invoice: {
          select: {
            id: true,
            invoice_number: true,
          },
        },
        shipping_proof: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async createShipment(
    body: CreateShipmentDto,
    fullname: string,
    user_id: string,
  ) {
    const invoice = await this.prismaService.invoice.findFirst({
      where: {
        id: body.invoice_id,
        is_deleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const existingShipment =
      await this.prismaService.documentShipment.findFirst({
        where: {
          invoice_id: body.invoice_id,
          deleted_at: null,
        },
      });

    if (existingShipment) {
      throw new BadRequestException('Shipment already exists for this invoice');
    }

    if (body.shipping_proof_id) {
      const file = await this.prismaService.fileAttachment.findFirst({
        where: { id: body.shipping_proof_id },
      });
      if (!file) {
        throw new NotFoundException('Shipping proof file not found');
      }
    }

    const shipment = await this.prismaService.$transaction(async (prisma) => {
      const create = await prisma.documentShipment.create({
        data: {
          invoice_id: body.invoice_id,
          courier: body.courier,
          tracking_number: body.tracking_number,
          shipping_date: new Date(body.shipping_date),
          shipping_proof_id: body.shipping_proof_id,
        },
      });

      await prisma.log.create({
        data: {
          action: 'CREATE',
          reference_id: create.id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} created a new shipment with tracking number ${body.tracking_number}`,
        },
      });

      await prisma.invoice.update({
        where: { id: body.invoice_id },
        data: { status: 'SHIPPED' },
      });

      return create;
    });

    return shipment;
  }

  async updateShipment(
    id: string,
    body: UpdateShipmentDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.documentShipment.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundException('Shipment not found');
    }

    const nextInvoiceId = body.invoice_id ?? existing.invoice_id;

    if (body.invoice_id && body.invoice_id !== existing.invoice_id) {
      const invoice = await this.prismaService.invoice.findFirst({
        where: {
          id: body.invoice_id,
          is_deleted: false,
        },
        select: {
          id: true,
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const duplicateInvoice =
        await this.prismaService.documentShipment.findFirst({
          where: {
            id: { not: id },
            invoice_id: nextInvoiceId,
            deleted_at: null,
          },
        });

      if (duplicateInvoice) {
        throw new BadRequestException(
          'Shipment already exists for this invoice',
        );
      }
    }

    if (body.shipping_proof_id) {
      const file = await this.prismaService.fileAttachment.findFirst({
        where: { id: body.shipping_proof_id },
      });
      if (!file) {
        throw new NotFoundException('Shipping proof file not found');
      }
    }

    const shipment = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.documentShipment.update({
        where: { id },
        data: {
          invoice_id: body.invoice_id,
          courier: body.courier,
          tracking_number: body.tracking_number,
          shipping_date: body.shipping_date
            ? new Date(body.shipping_date)
            : undefined,
          shipping_proof_id: body.shipping_proof_id,
        },
      });

      await prisma.log.create({
        data: {
          action: 'UPDATE',
          reference_id: id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} updated shipment with tracking number ${existing.tracking_number}`,
          details: JSON.stringify({
            before: {
              invoice_id: existing.invoice_id,
              courier: existing.courier,
              tracking_number: existing.tracking_number,
              shipping_date: existing.shipping_date,
              shipping_proof_id: existing.shipping_proof_id,
            },
            after: {
              invoice_id: update.invoice_id,
              courier: update.courier,
              tracking_number: update.tracking_number,
              shipping_date: update.shipping_date,
              shipping_proof_id: update.shipping_proof_id,
            },
          }),
        },
      });

      return update;
    });

    return shipment;
  }

  async deleteShipment(id: string, fullname: string, user_id: string) {
    const existing = await this.prismaService.documentShipment.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) {
      throw new NotFoundException('Shipment not found');
    }

    const deletedAt = new Date();

    const shipment = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.documentShipment.update({
        where: { id },
        data: {
          deleted_at: deletedAt,
        },
      });

      await prisma.log.create({
        data: {
          action: 'DELETE',
          reference_id: id,
          reference_type: 'INVOICE',
          user_id,
          description: `${fullname} deleted shipment with tracking number ${existing.tracking_number}`,
          details: JSON.stringify({
            before: {
              deleted_at: existing.deleted_at,
            },
            after: {
              deleted_at: deletedAt,
            },
          }),
        },
      });

      return update;
    });

    return shipment;
  }
}
