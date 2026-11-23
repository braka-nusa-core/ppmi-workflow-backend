import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  TermSnapshot,
  compareTermSets,
  createTermVersion,
  snapshotTerms,
} from './quotation-term-versions.util';

type Actor = { id: string; fullname: string };

@Injectable()
export class QuotationTermVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(quotationId: string) {
    await this.assertQuotation(quotationId);

    const versions = await this.prisma.quotationTermVersion.findMany({
      where: { quotationId },
      orderBy: { version: 'desc' },
    });

    return versions.map(({ terms, ...version }) => ({
      ...version,
      termCount: Array.isArray(terms) ? terms.length : 0,
    }));
  }

  async get(quotationId: string, version: number) {
    await this.assertQuotation(quotationId);
    return this.findVersion(quotationId, version);
  }

  /** Saves the current terms as a new version on request (always creates one). */
  async create(quotationId: string, note: string | undefined, actor: Actor) {
    await this.assertQuotation(quotationId);

    const created = await this.prisma.$transaction(async (tx) => {
      const version = await createTermVersion(tx, quotationId, 'MANUAL', {
        actorId: actor.id,
        note,
        force: true,
      });
      await tx.log.create({
        data: {
          action: 'CREATE',
          referenceId: quotationId,
          referenceType: 'QUOTATION_SLIP',
          userId: actor.id,
          description: `${actor.fullname} saved terms version ${version!.version}`,
        },
      });
      return version!;
    });

    return created;
  }

  /**
   * Compares two versions of the terms. `to` may be a version number or
   * "current" for the live terms of the quotation.
   */
  async compare(quotationId: string, from: number, to: number | 'current') {
    await this.assertQuotation(quotationId);

    const before = await this.findVersion(quotationId, from);
    const afterTerms =
      to === 'current'
        ? await snapshotTerms(this.prisma, quotationId)
        : ((await this.findVersion(quotationId, to))
            .terms as unknown as TermSnapshot[]);

    if (to !== 'current' && to === from) {
      throw new BadRequestException('Choose two different versions to compare');
    }

    return {
      from: {
        version: before.version,
        reason: before.reason,
        createdAt: before.createdAt,
      },
      to: to === 'current' ? 'current' : to,
      ...compareTermSets(before.terms as unknown as TermSnapshot[], afterTerms),
    };
  }

  private async findVersion(quotationId: string, version: number) {
    const found = await this.prisma.quotationTermVersion.findUnique({
      where: { quotationId_version: { quotationId, version } },
    });
    if (!found) throw new NotFoundException('Terms version not found');
    return found;
  }

  private async assertQuotation(quotationId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: { id: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
  }
}
