import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  CalcItemInput,
  calculateInvoice,
  money,
  serializeFigures,
} from './invoice-calculation';
import { InvoiceNumbersService } from './invoice-numbers.service';
import {
  CreateInvoiceDto,
  ListInvoicesQuery,
  UpdateInvoiceDto,
} from './invoices.validation';

type Actor = { id: string; fullname: string };
type Currency = 'IDR' | 'USD';

export const DEFAULT_PAYMENT_TERM_DAYS = 14;
export const DEFAULT_PAYMENT_DETAIL = 'FULL PAYMENT';

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

// Calendar date in Jakarta (UTC+7) as UTC midnight, so "today" matches what
// Finance sees on the wall even when the server clock runs in UTC.
const todayInJakarta = () =>
  new Date(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
  );

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'P2002';

const itemsInclude = {
  where: { deletedAt: null },
  orderBy: { sortOrder: 'asc' },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: InvoiceNumbersService,
  ) {}

  async list(query: ListInvoicesQuery) {
    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.currency && { currency: query.currency }),
      ...(query.requestInvoiceId && {
        requestInvoiceId: query.requestInvoiceId,
      }),
      ...(query.q && {
        invoiceNumber: { contains: query.q, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          requestInvoice: { select: { id: true, requestNumber: true } },
        },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: itemsInclude,
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        requestInvoice: { select: { id: true, requestNumber: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paid = await this.prisma.incomingPayment.aggregate({
      where: { invoiceId: id, deletedAt: null, status: 'PAID' },
      _sum: { amount: true },
    });
    const paidAmount = new Prisma.Decimal(paid._sum.amount ?? 0);
    const balanceDue = new Prisma.Decimal(
      invoice.balanceDue ?? invoice.grandTotal ?? 0,
    );

    return {
      ...invoice,
      paymentSummary: {
        balanceDue: money(balanceDue),
        paidAmount: money(paidAmount),
        remaining: money(balanceDue.minus(paidAmount)),
      },
    };
  }

  preview(dto: CreateInvoiceDto) {
    return serializeFigures(this.figures(dto.currency, dto));
  }

  async draft(requestInvoiceId: string) {
    const rfi = await this.findReadyRequestInvoice(requestInvoiceId);
    await this.assertNoInvoice(requestInvoiceId);

    const policy = await this.prisma.policy.findFirst({
      where: { id: rfi.policyId, deletedAt: null },
      include: {
        quotation: {
          include: {
            client: true,
            insuranceType: true,
            cargoQuotation: true,
            pniQuotation: {
              include: {
                vessels: {
                  where: { deletedAt: null },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
            objects: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    const quotation = policy.quotation;
    const cargo = quotation.cargoQuotation;

    const currency: Currency =
      quotation.sumInsuredCurrency === 'USD' ? 'USD' : 'IDR';
    const issueDate = todayInJakarta();

    const [leader, bank, invoiceNumber] = await Promise.all([
      this.prisma.policyParticipant.findFirst({
        where: {
          quotationId: quotation.id,
          role: 'LEADER',
          deletedAt: null,
        },
        include: { insuranceCompany: true },
      }),
      this.prisma.bank.findFirst({
        where: { currency, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.numbers.generate(issueDate, quotation.insuranceTypeId),
    ]);

    const objectName = (quotation.objects[0]?.data as { name?: unknown } | null)
      ?.name;
    const description =
      quotation.pniQuotation?.vessels[0]?.name ??
      (typeof objectName === 'string' && objectName.trim()
        ? objectName.trim()
        : null) ??
      quotation.interest ??
      '';

    const item: CalcItemInput = {
      description,
      policyNumber: policy.policyNumber,
      voyageFrom: cargo?.voyageFrom ?? null,
      voyageTo: cargo?.voyageTo ?? null,
      subjectInterest: cargo?.interestInsured ?? quotation.interest ?? null,
      sailingStart: policy.periodStart ?? cargo?.etd ?? null,
      sailingEnd: policy.periodEnd ?? cargo?.eta ?? null,
      sumInsured: quotation.sumInsured?.toFixed(2) ?? null,
      // Assumed to already be a percent (0.15 = 0.15%), like InvoiceItem.rate.
      rate: quotation.rate?.toFixed() ?? null,
    };

    return {
      requestInvoiceId,
      policyId: policy.id,
      quotationId: quotation.id,
      invoiceNumber,
      issueDate,
      paymentTermDays: DEFAULT_PAYMENT_TERM_DAYS,
      dueDate: addDays(issueDate, DEFAULT_PAYMENT_TERM_DAYS),
      currency,
      insuranceTypeLabel: quotation.insuranceType.code,
      billToName: quotation.client.name,
      billToAddress: quotation.client.address,
      coverName: leader?.insuranceCompany.name ?? null,
      bankId: bank?.id ?? null,
      paymentDetail: DEFAULT_PAYMENT_DETAIL,
      ...serializeFigures(this.figures(currency, { items: [item] })),
    };
  }

  async create(requestInvoiceId: string, dto: CreateInvoiceDto, actor: Actor) {
    const rfi = await this.findReadyRequestInvoice(requestInvoiceId);
    await this.assertNoInvoice(requestInvoiceId);

    const figures = this.figures(dto.currency, dto);
    const bank = await this.findBank(dto.bankId);

    const invoiceNumber =
      dto.invoiceNumber ??
      (await this.numbers.generate(
        dto.issueDate,
        await this.insuranceTypeIdOf(rfi.policyId),
      ));
    await this.assertNumberFree(invoiceNumber);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            requestInvoiceId,
            invoiceNumber,
            status: 'UNPAID',
            issueDate: dto.issueDate,
            dueDate: dto.dueDate ?? addDays(dto.issueDate, dto.paymentTermDays),
            paymentTermDays: dto.paymentTermDays,
            currency: dto.currency,
            insuranceTypeLabel: dto.insuranceTypeLabel,
            billToName: dto.billToName,
            billToAddress: dto.billToAddress,
            coverName: dto.coverName,
            paymentDetail: dto.paymentDetail,
            notes: dto.notes,
            signerName: dto.signerName,
            signerTitle: dto.signerTitle,
            issuedById: actor.id,
            ...this.bankData(bank),
            ...this.amountData(figures),
            items: { create: this.itemRows(figures.items) },
          },
          include: { items: itemsInclude },
        });

        await tx.log.create({
          data: {
            action: 'CREATE',
            referenceId: invoice.id,
            referenceType: 'INVOICE',
            userId: actor.id,
            description: `${actor.fullname} issued invoice ${invoice.invoiceNumber}`,
          },
        });

        return invoice;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('Invoice number is already used');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateInvoiceDto, actor: Actor) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { items: itemsInclude },
    });
    if (!existing) throw new NotFoundException('Invoice not found');

    const payments = await this.prisma.incomingPayment.count({
      where: { invoiceId: id, deletedAt: null },
    });
    if (payments > 0) {
      throw new BadRequestException(
        'Invoice already has payments and can no longer be edited',
      );
    }

    const currency = (dto.currency ?? existing.currency) as Currency;
    const items: CalcItemInput[] =
      dto.items ??
      existing.items.map((item) => ({
        description: item.description,
        policyNumber: item.policyNumber,
        voyageFrom: item.voyageFrom,
        voyageTo: item.voyageTo,
        subjectInterest: item.subjectInterest,
        sailingStart: item.sailingStart,
        sailingEnd: item.sailingEnd,
        sumInsured: item.sumInsured?.toFixed(2) ?? null,
        rate: item.rate?.toFixed() ?? null,
        total: item.total?.toFixed(2) ?? null,
      }));
    const figures = this.figures(currency, {
      items,
      discount: dto.discount ?? existing.discount?.toFixed(2),
      stampDutyPolicyCost:
        dto.stampDutyPolicyCost ?? existing.stampDutyPolicyCost?.toFixed(2),
    });

    if (dto.invoiceNumber && dto.invoiceNumber !== existing.invoiceNumber) {
      await this.assertNumberFree(dto.invoiceNumber);
    }

    // The due date follows the issue date and term unless it is sent explicitly.
    const termChanged =
      dto.issueDate !== undefined || dto.paymentTermDays !== undefined;
    const issueDate = dto.issueDate ?? existing.issueDate;
    const dueDate =
      dto.dueDate ??
      (termChanged && issueDate
        ? addDays(
            issueDate,
            dto.paymentTermDays ??
              existing.paymentTermDays ??
              DEFAULT_PAYMENT_TERM_DAYS,
          )
        : undefined);

    let bankData = {};
    if (dto.bankId !== undefined) {
      bankData = this.bankData(await this.findBank(dto.bankId));
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.items) {
          await tx.invoiceItem.updateMany({
            where: { invoiceId: id, deletedAt: null },
            data: { deletedAt: new Date() },
          });
          await tx.invoiceItem.createMany({
            data: this.itemRows(figures.items).map((row) => ({
              ...row,
              invoiceId: id,
            })),
          });
        }

        const invoice = await tx.invoice.update({
          where: { id },
          data: {
            ...(dto.invoiceNumber && { invoiceNumber: dto.invoiceNumber }),
            ...(dto.issueDate && { issueDate: dto.issueDate }),
            ...(dueDate && { dueDate }),
            ...(dto.paymentTermDays !== undefined && {
              paymentTermDays: dto.paymentTermDays,
            }),
            ...(dto.currency && { currency: dto.currency }),
            ...(dto.insuranceTypeLabel !== undefined && {
              insuranceTypeLabel: dto.insuranceTypeLabel,
            }),
            ...(dto.billToName && { billToName: dto.billToName }),
            ...(dto.billToAddress !== undefined && {
              billToAddress: dto.billToAddress,
            }),
            ...(dto.coverName !== undefined && { coverName: dto.coverName }),
            ...(dto.paymentDetail !== undefined && {
              paymentDetail: dto.paymentDetail,
            }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
            ...(dto.signerName !== undefined && { signerName: dto.signerName }),
            ...(dto.signerTitle !== undefined && {
              signerTitle: dto.signerTitle,
            }),
            ...bankData,
            // Amounts are always recomputed so they match the stored items.
            ...this.amountData(figures),
          },
          include: { items: itemsInclude },
        });

        await tx.log.create({
          data: {
            action: 'UPDATE',
            referenceId: id,
            referenceType: 'INVOICE',
            userId: actor.id,
            description: `${actor.fullname} updated invoice ${invoice.invoiceNumber}`,
          },
        });

        return invoice;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException('Invoice number is already used');
      }
      throw error;
    }
  }

  private figures(
    currency: Currency,
    source: {
      items: CalcItemInput[];
      discount?: string | null;
      stampDutyPolicyCost?: string | null;
    },
  ) {
    const figures = calculateInvoice({
      currency,
      items: source.items,
      discount: source.discount,
      stampDutyPolicyCost: source.stampDutyPolicyCost,
    });
    if (figures.nettPremium.isNegative()) {
      throw new BadRequestException(
        'Discount must not be greater than the gross premium',
      );
    }
    return figures;
  }

  private amountData(figures: ReturnType<typeof calculateInvoice>) {
    return {
      grossPremium: figures.grossPremium.toFixed(2),
      discount: figures.discount.toFixed(2),
      nettPremium: figures.nettPremium.toFixed(2),
      stampDutyPolicyCost: figures.stampDutyPolicyCost.toFixed(2),
      balanceDue: figures.balanceDue.toFixed(2),
      amountInWords: figures.amountInWords,
      // Legacy columns, kept in step with the new ones.
      subtotal: figures.nettPremium.toFixed(2),
      grandTotal: figures.balanceDue.toFixed(2),
      ppn: null,
    };
  }

  private itemRows(items: ReturnType<typeof calculateInvoice>['items']) {
    return items.map((item, index) => ({
      sortOrder: index,
      description: item.description,
      policyNumber: item.policyNumber,
      voyageFrom: item.voyageFrom,
      voyageTo: item.voyageTo,
      subjectInterest: item.subjectInterest,
      sailingStart: item.sailingStart,
      sailingEnd: item.sailingEnd,
      sumInsured: item.sumInsured,
      rate: item.rate,
      total: item.total?.toFixed(2) ?? null,
    }));
  }

  private bankData(
    bank: {
      id: string;
      name: string;
      accountName: string | null;
      accountNumber: string | null;
    } | null,
  ) {
    return {
      bankId: bank?.id ?? null,
      bankName: bank?.name ?? null,
      bankAccountName: bank?.accountName ?? null,
      bankAccountNumber: bank?.accountNumber ?? null,
    };
  }

  private async findBank(bankId?: string | null) {
    if (!bankId) return null;
    const bank = await this.prisma.bank.findFirst({
      where: { id: bankId, deletedAt: null },
    });
    if (!bank) throw new BadRequestException('Bank not found');
    return bank;
  }

  private async findReadyRequestInvoice(id: string) {
    const rfi = await this.prisma.requestInvoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!rfi) throw new NotFoundException('Request for invoice not found');
    if (rfi.status !== 'READY_FOR_INVOICE') {
      throw new BadRequestException(
        'Request for invoice must be READY_FOR_INVOICE',
      );
    }
    return rfi;
  }

  private async assertNoInvoice(requestInvoiceId: string) {
    const count = await this.prisma.invoice.count({
      where: { requestInvoiceId, deletedAt: null },
    });
    if (count > 0) {
      throw new BadRequestException(
        'An invoice already exists for this request for invoice',
      );
    }
  }

  private async assertNumberFree(invoiceNumber: string) {
    const used = await this.prisma.invoice.findFirst({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (used) throw new BadRequestException('Invoice number is already used');
  }

  private async insuranceTypeIdOf(policyId: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId },
      select: { quotation: { select: { insuranceTypeId: true } } },
    });
    return policy?.quotation.insuranceTypeId ?? null;
  }
}
