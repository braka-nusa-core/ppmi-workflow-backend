import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  CreateVesselSurveyDto,
  ListVesselSurveysQuery,
  UpdateVesselSurveyDto,
} from './vessel-surveys.validation';

type Actor = { id: string; fullname: string };

export const DEFAULT_SURVEY_STATUS = 'PLANNED';

const surveyInclude = {
  surveyor: { select: { id: true, name: true } },
  reportDocument: {
    select: { id: true, fileName: true, fileUrl: true, category: true },
  },
} as const;

@Injectable()
export class VesselSurveysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(vesselId: string, query: ListVesselSurveysQuery) {
    await this.assertVessel(vesselId);

    return this.prisma.vesselSurvey.findMany({
      where: {
        vesselId,
        deletedAt: null,
        ...(query.status && { status: query.status }),
      },
      include: surveyInclude,
      orderBy: [{ surveyDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(vesselId: string, id: string) {
    await this.assertVessel(vesselId);
    return this.findSurvey(vesselId, id);
  }

  async create(vesselId: string, dto: CreateVesselSurveyDto, actor: Actor) {
    const vessel = await this.assertVessel(vesselId);
    await this.assertReferences(vesselId, dto);

    return this.prisma.$transaction(async (tx) => {
      const survey = await tx.vesselSurvey.create({
        data: {
          vesselId,
          surveyorId: dto.surveyorId,
          quotationId: dto.quotationId,
          surveyType: dto.surveyType,
          status: dto.status ?? DEFAULT_SURVEY_STATUS,
          nominatedAt: dto.nominatedAt,
          surveyDate: dto.surveyDate,
          reportDate: dto.reportDate,
          validUntil: dto.validUntil,
          reportDocumentId: dto.reportDocumentId,
          note: dto.note,
          createdById: actor.id,
        },
        include: surveyInclude,
      });

      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: survey.id,
          referenceType: 'VESSEL_SURVEY',
          userId: actor.id,
          description: `${actor.fullname} created ${survey.surveyType ?? 'a'} survey for vessel ${vessel.name}`,
        },
      });

      return survey;
    });
  }

  async update(
    vesselId: string,
    id: string,
    dto: UpdateVesselSurveyDto,
    actor: Actor,
  ) {
    const vessel = await this.assertVessel(vesselId);
    const existing = await this.findSurvey(vesselId, id);
    await this.assertReferences(vesselId, dto);

    const surveyDate =
      dto.surveyDate !== undefined ? dto.surveyDate : existing.surveyDate;
    const validUntil =
      dto.validUntil !== undefined ? dto.validUntil : existing.validUntil;
    if (surveyDate && validUntil && surveyDate > validUntil) {
      throw new BadRequestException(
        'validUntil must not be earlier than surveyDate',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const survey = await tx.vesselSurvey.update({
        where: { id },
        data: {
          ...(dto.surveyorId !== undefined && { surveyorId: dto.surveyorId }),
          ...(dto.quotationId !== undefined && {
            quotationId: dto.quotationId,
          }),
          ...(dto.surveyType !== undefined && { surveyType: dto.surveyType }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.nominatedAt !== undefined && {
            nominatedAt: dto.nominatedAt,
          }),
          ...(dto.surveyDate !== undefined && { surveyDate: dto.surveyDate }),
          ...(dto.reportDate !== undefined && { reportDate: dto.reportDate }),
          ...(dto.validUntil !== undefined && { validUntil: dto.validUntil }),
          ...(dto.reportDocumentId !== undefined && {
            reportDocumentId: dto.reportDocumentId,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
        },
        include: surveyInclude,
      });

      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: id,
          referenceType: 'VESSEL_SURVEY',
          userId: actor.id,
          description: `${actor.fullname} updated survey of vessel ${vessel.name}`,
        },
      });

      return survey;
    });
  }

  async delete(vesselId: string, id: string, actor: Actor) {
    const vessel = await this.assertVessel(vesselId);
    await this.findSurvey(vesselId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.vesselSurvey.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.log.create({
        data: {
          action: 'DELETE',
          referenceId: id,
          referenceType: 'VESSEL_SURVEY',
          userId: actor.id,
          description: `${actor.fullname} deleted survey of vessel ${vessel.name}`,
        },
      });

      return { id };
    });
  }

  private async assertVessel(vesselId: string) {
    const vessel = await this.prisma.vessel.findFirst({
      where: { id: vesselId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!vessel) throw new NotFoundException('Vessel not found');
    return vessel;
  }

  private async findSurvey(vesselId: string, id: string) {
    const survey = await this.prisma.vesselSurvey.findFirst({
      where: { id, vesselId, deletedAt: null },
      include: surveyInclude,
    });
    if (!survey) throw new NotFoundException('Vessel survey not found');
    return survey;
  }

  /** The surveyor, quotation and report must exist; the report must belong to this vessel. */
  private async assertReferences(
    vesselId: string,
    dto: {
      surveyorId?: string | null;
      quotationId?: string | null;
      reportDocumentId?: string | null;
    },
  ) {
    if (dto.surveyorId) {
      const surveyor = await this.prisma.surveyor.findFirst({
        where: { id: dto.surveyorId, deletedAt: null },
        select: { id: true },
      });
      if (!surveyor) throw new BadRequestException('Surveyor not found');
    }
    if (dto.quotationId) {
      const quotation = await this.prisma.quotation.findFirst({
        where: { id: dto.quotationId, deletedAt: null },
        select: { id: true },
      });
      if (!quotation) throw new BadRequestException('Quotation not found');
    }
    if (dto.reportDocumentId) {
      const document = await this.prisma.vesselDocument.findFirst({
        where: { id: dto.reportDocumentId, vesselId, deletedAt: null },
        select: { id: true },
      });
      if (!document) {
        throw new BadRequestException(
          'Report document not found for this vessel',
        );
      }
    }
  }
}
