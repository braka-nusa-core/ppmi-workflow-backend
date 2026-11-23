import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateQuotationObjectDto,
  UpdateQuotationObjectDto,
} from './quotation-objects.validation';
import { QuotationsService } from './quotations.service';

type VesselSource = {
  name: string;
  imoNumber: string | null;
  vesselType: string | null;
  builtYear: number | null;
  grossTonnage: { toString(): string } | null;
  vesselClass: string | null;
  classNotApplicable: boolean;
  flag: string | null;
  tradingArea: string | null;
  portOfRegistry: string | null;
};

/** The vessel fields an object keeps as its own snapshot. Blank fields are left out. */
export function vesselSnapshot(vessel: VesselSource) {
  const snapshot: Record<string, unknown> = {
    name: vessel.name,
    imoNumber: vessel.imoNumber,
    vesselType: vessel.vesselType,
    builtYear: vessel.builtYear,
    grossTonnage:
      vessel.grossTonnage === null ? null : Number(vessel.grossTonnage),
    vesselClass: vessel.vesselClass,
    classNotApplicable: vessel.classNotApplicable,
    flag: vessel.flag,
    tradingArea: vessel.tradingArea,
    portOfRegistry: vessel.portOfRegistry,
  };
  return Object.fromEntries(
    Object.entries(snapshot).filter(([, value]) => value !== null),
  );
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class QuotationObjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async list(quotationId: string) {
    return this.prisma.quotationObject.findMany({
      where: { quotationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string, id: string) {
    const obj = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!obj) throw new NotFoundException('Quotation object not found');
    return obj;
  }

  async create(
    quotationId: string,
    dto: CreateQuotationObjectDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);

    // With a vesselId the object starts from the master's data. Anything sent
    // in `data` wins, and the master is never copied again afterwards.
    let data = dto.data;
    if (dto.vesselId) {
      const vessel = await this.findVessel(dto.vesselId);
      if (data === undefined || data === null || isPlainObject(data)) {
        data = { ...vesselSnapshot(vessel), ...(data ?? {}) };
      }
    }

    const object = await this.prisma.quotationObject.create({
      data: {
        quotationId,
        objectType: dto.objectType,
        vesselId: dto.vesselId,
        data,
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return object;
  }

  async update(
    quotationId: string,
    id: string,
    dto: UpdateQuotationObjectDto,
    actorId: string,
  ) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation object not found');
    if (dto.vesselId) await this.findVessel(dto.vesselId);

    const object = await this.prisma.quotationObject.update({
      where: { id },
      data: {
        ...(dto.objectType !== undefined && { objectType: dto.objectType }),
        ...(dto.vesselId !== undefined && { vesselId: dto.vesselId }),
        ...(dto.data !== undefined && { data: dto.data }),
      },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);
    return object;
  }

  private async findVessel(vesselId: string) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { id: vesselId, deletedAt: null },
    });
    if (!vessel) throw new BadRequestException(`Vessel ${vesselId} not found`);
    return vessel;
  }

  async delete(quotationId: string, id: string, actorId: string) {
    await this.quotationsService.assertEditable(quotationId, actorId);
    const existing = await this.prisma.quotationObject.findFirst({
      where: { id, quotationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Quotation object not found');

    await this.prisma.quotationObject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.quotationsService.markInsurerRevisionUpdated(quotationId);

    return { id };
  }
}
