import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../common/services/prisma.service';
import { CreatePniQuotationDto, UpdatePniQuotationDto } from './pni.validation';

type Actor = { id: string; fullname: string };
type Transaction = Prisma.TransactionClient;

const CLUB_FORMATS = [
  {
    code: 'INIGO_SYNDICATE_1301',
    displayName: '(Inigo Syndicate 1301)',
  },
  {
    code: 'EAGLE_OCEAN_MARINE',
    displayName: '(Eagle Ocean Marine / American S.O. Mutual P&I Assoc.)',
  },
  {
    code: 'MSIG_SPECIALTY_MARINE_NV',
    displayName: '(MSIG Europe / MSIG Specialty Marine NV)',
  },
] as const;

const TECHNICAL_DEPARTMENTS = new Set(['H&M', 'P&I', 'Cargo']);

@Injectable()
export class PniService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  listClubFormats() {
    return CLUB_FORMATS;
  }

  async getTemplate(clubFormat: string) {
    this.assertClubFormat(clubFormat);
    return this.prisma.qsTemplate.findMany({
      where: { pniClubFormat: clubFormat as never, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async list() {
    return this.prisma.quotation.findMany({
      where: { deletedAt: null, pniQuotation: { deletedAt: null } },
      include: {
        client: { select: { id: true, name: true, clientCode: true } },
        insuranceType: { select: { id: true, code: true, name: true } },
        pniQuotation: {
          select: { id: true, clubFormat: true, referenceNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(quotationId: string) {
    const pniQuotation = await this.prisma.pniQuotation.findFirst({
      where: { quotationId, deletedAt: null, quotation: { deletedAt: null } },
      include: this.detailInclude(),
    });
    if (!pniQuotation) throw new NotFoundException('P&I quotation not found');
    return pniQuotation;
  }

  async create(dto: CreatePniQuotationDto, actor: Actor) {
    const [quotationNumber, technicalUnitId] = await Promise.all([
      this.generateQuotationNumber(),
      this.getTechnicalUnitId(actor.id),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const insuranceType = await tx.insuranceType.findFirst({
        where: { id: dto.quotation.insuranceTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!insuranceType) {
        throw new BadRequestException('Insurance type not found');
      }

      const clientId = await this.resolveClientId(tx, dto.quotation, actor);
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          clientId,
          insuranceTypeId: insuranceType.id,
          technicalUnitId,
          ...this.quotationData(dto.quotation),
          status: 'DRAFT',
          createdById: actor.id,
        },
      });

      const pniQuotation = await tx.pniQuotation.create({
        data: {
          quotationId: quotation.id,
          ...this.pniData(dto.pni),
        },
      });

      await this.applyChildren(tx, pniQuotation.id, dto);
      await tx.quotationHistory.create({
        data: {
          quotationId: quotation.id,
          toStatus: 'DRAFT',
          action: 'CREATE',
          actorId: actor.id,
          note: 'P&I quotation created',
        },
      });
      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: quotation.id,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} created P&I quotation ${quotation.quotationNumber}`,
        },
      });

      return tx.pniQuotation.findUniqueOrThrow({
        where: { id: pniQuotation.id },
        include: this.detailInclude(),
      });
    });
  }

  async update(quotationId: string, dto: UpdatePniQuotationDto, actor: Actor) {
    const existing = await this.prisma.pniQuotation.findFirst({
      where: { quotationId, deletedAt: null, quotation: { deletedAt: null } },
      include: {
        quotation: { select: { status: true, technicalUnitId: true } },
      },
    });
    if (!existing) throw new NotFoundException('P&I quotation not found');
    if (!['DRAFT', 'REVISION'].includes(existing.quotation.status)) {
      throw new BadRequestException(
        'P&I quotation can only be edited in DRAFT or REVISION status',
      );
    }
    await this.assertTechnicalUnitOwnership(
      existing.quotation.technicalUnitId,
      actor.id,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.quotation?.clientId) {
        const client = await tx.client.findFirst({
          where: { id: dto.quotation.clientId, deletedAt: null },
          select: { id: true },
        });
        if (!client) throw new BadRequestException('Client not found');
      }

      if (dto.quotation) {
        await tx.quotation.update({
          where: { id: quotationId },
          data: this.quotationData(dto.quotation),
        });
      }
      if (dto.pni) {
        await tx.pniQuotation.update({
          where: { id: existing.id },
          data: this.pniData(dto.pni),
        });
      }

      await this.removeChildren(tx, existing.id, dto.remove);
      await this.applyChildren(tx, existing.id, dto);
      await tx.log.create({
        data: {
          action: 'UPDATE',
          referenceId: quotationId,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} updated P&I quotation`,
        },
      });

      return tx.pniQuotation.findUniqueOrThrow({
        where: { id: existing.id },
        include: this.detailInclude(),
      });
    });
  }

  private detailInclude() {
    return {
      quotation: {
        include: {
          client: true,
          insuranceType: true,
          technicalUnit: { select: { id: true, name: true } },
        },
      },
      vessels: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          coverages: { where: { deletedAt: null } },
        },
      },
      insuranceBlocks: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          deductibles: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' as const },
            include: { vesselScopes: true },
          },
          provisions: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' as const },
            include: { vesselScopes: true },
          },
          coverRestrictions: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
      provisions: {
        where: { deletedAt: null, insuranceBlockId: null },
        orderBy: { sortOrder: 'asc' as const },
        include: { vesselScopes: true },
      },
      installments: {
        where: { deletedAt: null },
        orderBy: { installmentNo: 'asc' as const },
      },
      requiredDocuments: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
      organizationRoles: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
      coverRestrictions: {
        where: { deletedAt: null, insuranceBlockId: null },
        orderBy: { sortOrder: 'asc' as const },
      },
    };
  }

  private async applyChildren(
    tx: Transaction,
    pniQuotationId: string,
    dto: any,
  ) {
    const vesselRefs = new Map<string, string>();
    const blockRefs = new Map<string, string>();

    for (const input of dto.vessels ?? []) {
      const data = {
        name: input.name,
        imoNumber: input.imoNumber,
        vesselType: input.vesselType,
        builtYear: input.builtYear,
        flag: input.flag,
        vesselClass: input.vesselClass,
        classNotApplicable: input.classNotApplicable,
        grossTonnage: input.grossTonnage,
        portOfRegistry: input.portOfRegistry,
        sortOrder: input.sortOrder,
        details: this.json(input.details),
      };
      const vessel = input.id
        ? await this.updateOwnedVessel(tx, input.id, pniQuotationId, data)
        : await tx.pniVessel.create({ data: { pniQuotationId, ...data } });
      vesselRefs.set(vessel.id, vessel.id);
      if (input.key) vesselRefs.set(input.key, vessel.id);
    }

    for (const input of dto.insuranceBlocks ?? []) {
      const data = {
        typeOfInsurance: input.typeOfInsurance,
        security: input.security,
        policyWordingReference: input.policyWordingReference,
        tradingArea: input.tradingArea,
        paymentWarrantyText: input.paymentWarrantyText,
        maximumInsured: input.maximumInsured,
        currency: input.currency,
        premium: input.premium,
        premiumBasis: input.premiumBasis,
        sortOrder: input.sortOrder,
        details: this.json(input.details),
      };
      const block = input.id
        ? await this.updateOwnedBlock(tx, input.id, pniQuotationId, data)
        : await tx.pniInsuranceBlock.create({
            data: { pniQuotationId, ...data },
          });
      blockRefs.set(block.id, block.id);
      if (input.key) blockRefs.set(input.key, block.id);
    }

    for (const input of dto.insuranceBlocks ?? []) {
      if (input.inheritsFromBlockRef === undefined) continue;
      const blockId = await this.resolveBlockRef(
        tx,
        pniQuotationId,
        input.id ?? input.key!,
        blockRefs,
      );
      const inheritsFromBlockId = input.inheritsFromBlockRef
        ? await this.resolveBlockRef(
            tx,
            pniQuotationId,
            input.inheritsFromBlockRef,
            blockRefs,
          )
        : null;
      if (blockId === inheritsFromBlockId) {
        throw new BadRequestException(
          'An insurance block cannot inherit itself',
        );
      }
      await tx.pniInsuranceBlock.update({
        where: { id: blockId },
        data: { inheritsFromBlockId },
      });
    }

    for (const input of dto.vesselCoverages ?? []) {
      const pniVesselId = await this.resolveVesselRef(
        tx,
        pniQuotationId,
        input.vesselRef,
        vesselRefs,
      );
      const insuranceBlockId = await this.resolveBlockRef(
        tx,
        pniQuotationId,
        input.insuranceBlockRef,
        blockRefs,
      );
      const data = {
        pniVesselId,
        insuranceBlockId,
        annualPremium: input.annualPremium,
        limitAmount: input.limitAmount,
        currency: input.currency,
        details: this.json(input.details),
      };
      if (input.id) {
        const existing = await tx.pniVesselCoverage.findFirst({
          where: { id: input.id, deletedAt: null, vessel: { pniQuotationId } },
        });
        if (!existing)
          throw new NotFoundException('P&I vessel coverage not found');
        await tx.pniVesselCoverage.update({ where: { id: input.id }, data });
      } else {
        await tx.pniVesselCoverage.upsert({
          where: {
            pniVesselId_insuranceBlockId: { pniVesselId, insuranceBlockId },
          },
          create: data,
          update: { ...data, deletedAt: null },
        });
      }
    }

    for (const input of dto.provisions ?? []) {
      const scope = input.scope ?? 'QUOTE';
      const vesselIds = await this.resolveVesselRefs(
        tx,
        pniQuotationId,
        input.vesselRefs ?? [],
        vesselRefs,
      );
      this.assertProvisionScope(scope, vesselIds);
      const insuranceBlockId =
        input.insuranceBlockRef === undefined
          ? undefined
          : input.insuranceBlockRef
            ? await this.resolveBlockRef(
                tx,
                pniQuotationId,
                input.insuranceBlockRef,
                blockRefs,
              )
            : null;
      const data = {
        type: input.type,
        source: input.source,
        scope,
        title: input.title,
        content: input.content,
        reference: input.reference,
        conditionRule: this.json(input.conditionRule),
        sortOrder: input.sortOrder,
        ...(insuranceBlockId !== undefined && { insuranceBlockId }),
      };
      const provision = input.id
        ? await this.updateOwnedProvision(tx, input.id, pniQuotationId, data)
        : await tx.pniProvision.create({ data: { pniQuotationId, ...data } });
      if (input.vesselRefs !== undefined) {
        await tx.pniProvisionVessel.deleteMany({
          where: { provisionId: provision.id },
        });
        if (vesselIds.length) {
          await tx.pniProvisionVessel.createMany({
            data: vesselIds.map((vesselId) => ({
              provisionId: provision.id,
              vesselId,
            })),
          });
        }
      }
    }

    for (const input of dto.deductibles ?? []) {
      const insuranceBlockId = await this.resolveBlockRef(
        tx,
        pniQuotationId,
        input.insuranceBlockRef,
        blockRefs,
      );
      const vesselIds = await this.resolveVesselRefs(
        tx,
        pniQuotationId,
        input.vesselRefs ?? [],
        vesselRefs,
      );
      this.assertDeductibleScope(input.scope, vesselIds);
      const data = {
        insuranceBlockId,
        scope: input.scope,
        claimCategory: input.claimCategory,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        sortOrder: input.sortOrder,
      };
      const deductible = input.id
        ? await this.updateOwnedDeductible(tx, input.id, pniQuotationId, data)
        : await tx.pniDeductible.create({ data });
      if (input.vesselRefs !== undefined) {
        await tx.pniDeductibleVessel.deleteMany({
          where: { deductibleId: deductible.id },
        });
        if (vesselIds.length) {
          await tx.pniDeductibleVessel.createMany({
            data: vesselIds.map((vesselId) => ({
              deductibleId: deductible.id,
              vesselId,
            })),
          });
        }
      }
    }

    for (const input of dto.installments ?? []) {
      const data = {
        installmentNo: input.installmentNo,
        amount: input.amount,
        currency: input.currency,
        dueDate: this.date(input.dueDate),
      };
      if (input.id) {
        await this.updateOwnedInstallment(tx, input.id, pniQuotationId, data);
      } else {
        await tx.pniInstallment.upsert({
          where: {
            pniQuotationId_installmentNo: {
              pniQuotationId,
              installmentNo: input.installmentNo,
            },
          },
          create: { pniQuotationId, ...data },
          update: { ...data, deletedAt: null },
        });
      }
    }

    await this.applySimpleChildren(tx, pniQuotationId, dto, blockRefs);
  }

  private async applySimpleChildren(
    tx: Transaction,
    pniQuotationId: string,
    dto: any,
    blockRefs: Map<string, string>,
  ) {
    for (const input of dto.requiredDocuments ?? []) {
      const data = {
        name: input.name,
        isRequired: input.isRequired,
        sortOrder: input.sortOrder,
      };
      if (input.id) {
        await this.updateOwnedRequiredDocument(
          tx,
          input.id,
          pniQuotationId,
          data,
        );
      } else {
        await tx.pniRequiredDocument.create({
          data: { pniQuotationId, ...data },
        });
      }
    }
    for (const input of dto.organizationRoles ?? []) {
      const data = {
        organization: input.organization,
        role: input.role,
        sortOrder: input.sortOrder,
      };
      if (input.id) {
        await this.updateOwnedOrganizationRole(
          tx,
          input.id,
          pniQuotationId,
          data,
        );
      } else {
        await tx.pniOrganizationRole.create({
          data: { pniQuotationId, ...data },
        });
      }
    }
    for (const input of dto.coverRestrictions ?? []) {
      const insuranceBlockId =
        input.insuranceBlockRef === undefined
          ? undefined
          : input.insuranceBlockRef
            ? await this.resolveBlockRef(
                tx,
                pniQuotationId,
                input.insuranceBlockRef,
                blockRefs,
              )
            : null;
      const data = {
        name: input.name,
        partReference: input.partReference,
        sectionReference: input.sectionReference,
        isSelected: input.isSelected,
        sortOrder: input.sortOrder,
        ...(insuranceBlockId !== undefined && { insuranceBlockId }),
      };
      if (input.id) {
        const existing = await tx.pniCoverRestriction.findFirst({
          where: { id: input.id, pniQuotationId, deletedAt: null },
        });
        if (!existing)
          throw new NotFoundException('P&I cover restriction not found');
        await tx.pniCoverRestriction.update({ where: { id: input.id }, data });
      } else {
        await tx.pniCoverRestriction.create({
          data: { pniQuotationId, ...data },
        });
      }
    }
  }

  private async removeChildren(
    tx: Transaction,
    pniQuotationId: string,
    remove?: UpdatePniQuotationDto['remove'],
  ) {
    if (!remove) return;
    const now = new Date();
    if (remove.provisionIds?.length) {
      await this.assertOwnedCount(
        tx.pniProvision,
        remove.provisionIds,
        { pniQuotationId, deletedAt: null },
        'P&I provision',
      );
      await tx.pniProvisionVessel.deleteMany({
        where: { provisionId: { in: remove.provisionIds } },
      });
      await tx.pniProvision.updateMany({
        where: { id: { in: remove.provisionIds } },
        data: { deletedAt: now },
      });
    }
    if (remove.deductibleIds?.length) {
      await this.assertOwnedCount(
        tx.pniDeductible,
        remove.deductibleIds,
        { insuranceBlock: { pniQuotationId }, deletedAt: null },
        'P&I deductible',
      );
      await tx.pniDeductibleVessel.deleteMany({
        where: { deductibleId: { in: remove.deductibleIds } },
      });
      await tx.pniDeductible.updateMany({
        where: { id: { in: remove.deductibleIds } },
        data: { deletedAt: now },
      });
    }
    if (remove.insuranceBlockIds?.length) {
      await this.assertOwnedCount(
        tx.pniInsuranceBlock,
        remove.insuranceBlockIds,
        { pniQuotationId, deletedAt: null },
        'P&I insurance block',
      );
      await tx.pniProvision.updateMany({
        where: { insuranceBlockId: { in: remove.insuranceBlockIds } },
        data: { insuranceBlockId: null },
      });
      await tx.pniCoverRestriction.updateMany({
        where: { insuranceBlockId: { in: remove.insuranceBlockIds } },
        data: { insuranceBlockId: null },
      });
      await tx.pniInsuranceBlock.updateMany({
        where: { inheritsFromBlockId: { in: remove.insuranceBlockIds } },
        data: { inheritsFromBlockId: null },
      });
      await tx.pniDeductible.updateMany({
        where: { insuranceBlockId: { in: remove.insuranceBlockIds } },
        data: { deletedAt: now },
      });
      await tx.pniVesselCoverage.updateMany({
        where: { insuranceBlockId: { in: remove.insuranceBlockIds } },
        data: { deletedAt: now },
      });
      await tx.pniInsuranceBlock.updateMany({
        where: { id: { in: remove.insuranceBlockIds } },
        data: { deletedAt: now },
      });
    }
    if (remove.vesselIds?.length) {
      await this.assertOwnedCount(
        tx.pniVessel,
        remove.vesselIds,
        { pniQuotationId, deletedAt: null },
        'P&I vessel',
      );
      await tx.pniProvisionVessel.deleteMany({
        where: { vesselId: { in: remove.vesselIds } },
      });
      await tx.pniDeductibleVessel.deleteMany({
        where: { vesselId: { in: remove.vesselIds } },
      });
      await tx.pniVesselCoverage.updateMany({
        where: { pniVesselId: { in: remove.vesselIds } },
        data: { deletedAt: now },
      });
      await tx.pniVessel.updateMany({
        where: { id: { in: remove.vesselIds } },
        data: { deletedAt: now },
      });
    }
    await this.softDeleteSimple(
      tx.pniInstallment,
      remove.installmentIds,
      pniQuotationId,
      now,
      'P&I installment',
    );
    await this.softDeleteSimple(
      tx.pniRequiredDocument,
      remove.requiredDocumentIds,
      pniQuotationId,
      now,
      'P&I required document',
    );
    await this.softDeleteSimple(
      tx.pniOrganizationRole,
      remove.organizationRoleIds,
      pniQuotationId,
      now,
      'P&I organization role',
    );
    await this.softDeleteSimple(
      tx.pniCoverRestriction,
      remove.coverRestrictionIds,
      pniQuotationId,
      now,
      'P&I cover restriction',
    );
  }

  private async resolveClientId(
    tx: Transaction,
    quotation: CreatePniQuotationDto['quotation'],
    actor: Actor,
  ) {
    if (quotation.clientId) {
      const client = await tx.client.findFirst({
        where: { id: quotation.clientId, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new BadRequestException('Client not found');
      return client.id;
    }
    const clientCode = await this.clientsService.generateClientCode();
    const client = await tx.client.create({
      data: { clientCode, ...quotation.client! },
    });
    await tx.log.create({
      data: {
        action: 'CREATE',
        referenceId: client.id,
        referenceType: 'QUOTATION_SLIP',
        userId: actor.id,
        description: `${actor.fullname} created client ${client.name} (${client.clientCode}) via P&I quotation creation`,
      },
    });
    return client.id;
  }

  private async resolveVesselRefs(
    tx: Transaction,
    pniQuotationId: string,
    refs: string[],
    cache: Map<string, string>,
  ) {
    return Promise.all(
      refs.map((ref) => this.resolveVesselRef(tx, pniQuotationId, ref, cache)),
    );
  }

  private async resolveVesselRef(
    tx: Transaction,
    pniQuotationId: string,
    ref: string,
    cache: Map<string, string>,
  ) {
    const cached = cache.get(ref);
    if (cached) return cached;
    const vessel = await tx.pniVessel.findFirst({
      where: { id: ref, pniQuotationId, deletedAt: null },
      select: { id: true },
    });
    if (!vessel)
      throw new BadRequestException(`P&I vessel reference ${ref} is invalid`);
    cache.set(ref, vessel.id);
    return vessel.id;
  }

  private async resolveBlockRef(
    tx: Transaction,
    pniQuotationId: string,
    ref: string,
    cache: Map<string, string>,
  ) {
    const cached = cache.get(ref);
    if (cached) return cached;
    const block = await tx.pniInsuranceBlock.findFirst({
      where: { id: ref, pniQuotationId, deletedAt: null },
      select: { id: true },
    });
    if (!block)
      throw new BadRequestException(
        `P&I insurance block reference ${ref} is invalid`,
      );
    cache.set(ref, block.id);
    return block.id;
  }

  private async updateOwnedVessel(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const vessel = await tx.pniVessel.findFirst({
      where: { id, pniQuotationId, deletedAt: null },
    });
    if (!vessel) throw new NotFoundException('P&I vessel not found');
    return tx.pniVessel.update({ where: { id }, data });
  }

  private async updateOwnedBlock(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const block = await tx.pniInsuranceBlock.findFirst({
      where: { id, pniQuotationId, deletedAt: null },
    });
    if (!block) throw new NotFoundException('P&I insurance block not found');
    return tx.pniInsuranceBlock.update({ where: { id }, data });
  }

  private async updateOwnedProvision(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const provision = await tx.pniProvision.findFirst({
      where: { id, pniQuotationId, deletedAt: null },
    });
    if (!provision) throw new NotFoundException('P&I provision not found');
    return tx.pniProvision.update({ where: { id }, data });
  }

  private async updateOwnedDeductible(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const deductible = await tx.pniDeductible.findFirst({
      where: { id, deletedAt: null, insuranceBlock: { pniQuotationId } },
    });
    if (!deductible) throw new NotFoundException('P&I deductible not found');
    return tx.pniDeductible.update({ where: { id }, data });
  }

  private async updateOwnedInstallment(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const installment = await tx.pniInstallment.findFirst({
      where: { id, pniQuotationId, deletedAt: null },
    });
    if (!installment) throw new NotFoundException('P&I installment not found');
    return tx.pniInstallment.update({ where: { id }, data });
  }

  private async updateOwnedRequiredDocument(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const document = await tx.pniRequiredDocument.findFirst({
      where: { id, pniQuotationId, deletedAt: null },
    });
    if (!document)
      throw new NotFoundException('P&I required document not found');
    return tx.pniRequiredDocument.update({ where: { id }, data });
  }

  private async updateOwnedOrganizationRole(
    tx: Transaction,
    id: string,
    pniQuotationId: string,
    data: any,
  ) {
    const role = await tx.pniOrganizationRole.findFirst({
      where: { id, pniQuotationId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('P&I organization role not found');
    return tx.pniOrganizationRole.update({ where: { id }, data });
  }

  private async assertOwnedCount(
    model: any,
    ids: string[],
    where: any,
    label: string,
  ) {
    const count = await model.count({ where: { ...where, id: { in: ids } } });
    if (count !== new Set(ids).size)
      throw new NotFoundException(`${label} not found`);
  }

  private async softDeleteSimple(
    model: any,
    ids: string[] | undefined,
    pniQuotationId: string,
    deletedAt: Date,
    label: string,
  ) {
    if (!ids?.length) return;
    await this.assertOwnedCount(
      model,
      ids,
      { pniQuotationId, deletedAt: null },
      label,
    );
    await model.updateMany({ where: { id: { in: ids } }, data: { deletedAt } });
  }

  private assertProvisionScope(scope: string, vesselIds: string[]) {
    if (scope === 'SELECTED_VESSELS' && !vesselIds.length) {
      throw new BadRequestException(
        'SELECTED_VESSELS provision requires vesselRefs',
      );
    }
    if (scope !== 'SELECTED_VESSELS' && vesselIds.length) {
      throw new BadRequestException(
        'Only SELECTED_VESSELS provision may have vesselRefs',
      );
    }
  }

  private assertDeductibleScope(scope: string, vesselIds: string[]) {
    if (scope === 'SELECTED_VESSELS' && !vesselIds.length) {
      throw new BadRequestException(
        'SELECTED_VESSELS deductible requires vesselRefs',
      );
    }
    if (scope !== 'SELECTED_VESSELS' && vesselIds.length) {
      throw new BadRequestException(
        'Only SELECTED_VESSELS deductible may have vesselRefs',
      );
    }
  }

  private pniData(input: any) {
    return {
      ...(input.clubFormat !== undefined && { clubFormat: input.clubFormat }),
      ...(input.referenceNumber !== undefined && {
        referenceNumber: input.referenceNumber,
      }),
      ...(input.validityDays !== undefined && {
        validityDays: input.validityDays,
      }),
      ...(input.assuredDomicile !== undefined && {
        assuredDomicile: input.assuredDomicile,
      }),
      ...(input.broker !== undefined && { broker: input.broker }),
      ...(input.insurerOrSecurity !== undefined && {
        insurerOrSecurity: input.insurerOrSecurity,
      }),
      ...(input.tradingLimits !== undefined && {
        tradingLimits: input.tradingLimits,
      }),
      ...(input.paymentTermsText !== undefined && {
        paymentTermsText: input.paymentTermsText,
      }),
      ...(input.subjectivities !== undefined && {
        subjectivities: input.subjectivities,
      }),
      ...(input.importantInformation !== undefined && {
        importantInformation: input.importantInformation,
      }),
      ...(input.signatureName !== undefined && {
        signatureName: input.signatureName,
      }),
      ...(input.signatureCity !== undefined && {
        signatureCity: input.signatureCity,
      }),
      ...(input.signatureDate !== undefined && {
        signatureDate: this.date(input.signatureDate),
      }),
      ...(input.details !== undefined && { details: this.json(input.details) }),
    };
  }

  private quotationData(input: any) {
    return {
      ...(input.clientId !== undefined && { clientId: input.clientId }),
      ...(input.insured !== undefined && { insured: input.insured }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.quotationDate !== undefined && {
        quotationDate: this.date(input.quotationDate),
      }),
      ...(input.periodStart !== undefined && {
        periodStart: this.date(input.periodStart),
      }),
      ...(input.periodEnd !== undefined && {
        periodEnd: this.date(input.periodEnd),
      }),
      ...(input.interest !== undefined && { interest: input.interest }),
      ...(input.rate !== undefined && { rate: input.rate }),
      ...(input.premium !== undefined && { premium: input.premium }),
      ...(input.deductible !== undefined && { deductible: input.deductible }),
      ...(input.brokerage !== undefined && { brokerage: input.brokerage }),
      ...(input.templateVersion !== undefined && {
        templateVersion: input.templateVersion,
      }),
    };
  }

  private date(value?: string) {
    if (!value) return value === undefined ? undefined : null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date');
    return date;
  }

  private json(value?: Record<string, unknown>) {
    return value === undefined
      ? undefined
      : (value as unknown as Prisma.InputJsonValue);
  }

  private async generateQuotationNumber() {
    const now = new Date();
    const prefix = `QTN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
    const last = await this.prisma.quotation.findFirst({
      where: { quotationNumber: { startsWith: prefix } },
      orderBy: { quotationNumber: 'desc' },
      select: { quotationNumber: true },
    });
    const sequence = last
      ? parseInt(last.quotationNumber.slice(-3), 10) + 1
      : 1;
    return `${prefix}${String(sequence).padStart(3, '0')}`;
  }

  private async getTechnicalUnitId(actorId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null },
      select: {
        organizationUnit: {
          select: {
            id: true,
            name: true,
            type: true,
            deletedAt: true,
            parent: { select: { name: true, type: true, deletedAt: true } },
          },
        },
      },
    });
    const unit = user?.organizationUnit;
    if (
      !unit ||
      unit.deletedAt ||
      unit.type !== 'DEPARTMENT' ||
      !TECHNICAL_DEPARTMENTS.has(unit.name) ||
      !unit.parent ||
      unit.parent.deletedAt ||
      unit.parent.type !== 'DIVISION' ||
      unit.parent.name !== 'Teknik'
    ) {
      throw new ForbiddenException(
        'Only users assigned to Teknik H&M, P&I, or Cargo can create quotations',
      );
    }
    return unit.id;
  }

  private async assertTechnicalUnitOwnership(
    technicalUnitId: string | null,
    actorId: string,
  ) {
    if (!technicalUnitId) return;
    const actor = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null },
      select: { role: true, organizationUnitId: true },
    });
    if (!actor) throw new ForbiddenException('User is no longer active');
    if (
      actor.role !== 'SUPERADMIN' &&
      actor.organizationUnitId !== technicalUnitId
    ) {
      throw new ForbiddenException(
        'Quotation belongs to another technical unit',
      );
    }
  }

  private assertClubFormat(clubFormat: string) {
    if (!CLUB_FORMATS.some((format) => format.code === clubFormat)) {
      throw new BadRequestException('Unknown P&I club format');
    }
  }
}
