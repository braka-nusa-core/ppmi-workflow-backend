import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateBankDto,
  CreateDivisionDto,
  CreateRoleDto,
  DashboardStats,
  RecentActivityItem,
  UpdateBankDto,
  UpdateDivisionDto,
  UpdateRoleDto,
  UpdateUserDto,
  WorkflowStageResult,
} from './app.validation';
import { PrismaService } from './common/services/prisma.service';
import {
  InvoiceStatus,
  PaymentStatus,
  QSSTATUS,
  VoucherStatus,
} from './generated/prisma/enums';
import { hashPassword } from './utils/bcrypt.util';

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  listDivisions() {
    return this.prismaService.division.findMany({
      orderBy: { name: 'asc' },
    });
  }

  getDivision(id: string) {
    return this.prismaService.division.findUnique({
      where: { id },
    });
  }

  async createDivision(
    body: CreateDivisionDto,
    fullname: string,
    user_id: string,
  ) {
    const duplicate = await this.prismaService.division.findFirst({
      where: {
        name: body.name,
      },
    });

    if (duplicate) {
      throw new BadRequestException('Division name already exists');
    }

    const code = await this.generateDivisionCode();

    const division = await this.prismaService.$transaction(async (prisma) => {
      const create = await prisma.division.create({
        data: {
          code,
          name: body.name,
          description: body.description,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      await prisma.log.create({
        data: {
          action: 'CREATE',
          reference_id: create.id,
          reference_type: 'DIVISION',
          user_id,
          description: `${fullname} created a new division with name ${body.name}`,
        },
      });
      return create;
    });

    return division;
  }

  async updateDivision(
    id: string,
    body: UpdateDivisionDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.division.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Division not found');
    }

    if (body.name) {
      const duplicate = await this.prismaService.division.findFirst({
        where: {
          id: { not: id },
          name: body.name,
        },
      });

      if (duplicate) {
        throw new BadRequestException('Division name already exists');
      }
    }

    const division = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.division.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      });

      await prisma.log.create({
        data: {
          action: 'UPDATE',
          reference_id: id,
          reference_type: 'DIVISION',
          user_id,
          description: `${fullname} updated a ${body.name ? 'division name' : 'division description'} from ${body.name ? existing.name : existing.description} to ${body.name ? body.name : body.description}`,
          details: JSON.stringify({
            before: {
              name: existing.name,
              description: existing.description,
            },
            after: {
              name: update.name,
              description: update.description,
            },
          }),
        },
      });
      return update;
    });

    return division;
  }

  listRoles() {
    return this.prismaService.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  getRole(id: string) {
    return this.prismaService.role.findUnique({
      where: { id },
    });
  }

  async createRole(body: CreateRoleDto, fullname: string, user_id: string) {
    const duplicate = await this.prismaService.role.findFirst({
      where: {
        name: body.name,
      },
    });

    if (duplicate) {
      throw new BadRequestException('Role name already exists');
    }

    const code = await this.generateRoleCode();

    const role = await this.prismaService.$transaction(async (prisma) => {
      const create = await prisma.role.create({
        data: {
          code,
          name: body.name,
          description: body.description,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      await prisma.log.create({
        data: {
          action: 'CREATE',
          reference_id: create.id,
          reference_type: 'ROLE',
          user_id,
          description: `${fullname} created a new role with name ${body.name}`,
        },
      });

      return create;
    });

    return role;
  }

  async updateRole(
    id: string,
    body: UpdateRoleDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.role.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (body.name) {
      const duplicate = await this.prismaService.role.findFirst({
        where: {
          id: { not: id },
          name: body.name,
        },
      });

      if (duplicate) {
        throw new BadRequestException('Role name already exists');
      }
    }

    const role = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.role.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      });

      await prisma.log.create({
        data: {
          action: 'UPDATE',
          reference_id: id,
          reference_type: 'ROLE',
          user_id,
          description: `${fullname} updated a ${body.name ? 'role name' : 'role description'} from ${body.name ? existing.name : existing.description} to ${body.name ? body.name : body.description}`,
          details: JSON.stringify({
            before: {
              name: existing.name,
              description: existing.description,
            },
            after: {
              name: update.name,
              description: update.description,
            },
          }),
        },
      });

      return update;
    });

    return role;
  }

  listBanks() {
    return this.prismaService.bank.findMany({
      where: { is_deleted: false },
      orderBy: { name: 'asc' },
    });
  }

  getBank(id: string) {
    return this.prismaService.bank.findFirst({
      where: { id, is_deleted: false },
    });
  }

  async createBank(body: CreateBankDto, fullname: string, user_id: string) {
    const duplicateName = await this.prismaService.bank.findFirst({
      where: { name: body.name },
    });

    if (duplicateName) {
      throw new BadRequestException('Bank name already exists');
    }

    const duplicateAccount = await this.prismaService.bank.findFirst({
      where: { account_number: body.account_number },
    });

    if (duplicateAccount) {
      throw new BadRequestException('Bank account number already exists');
    }

    const bank = await this.prismaService.$transaction(async (prisma) => {
      const create = await prisma.bank.create({
        data: {
          name: body.name,
          account_number: body.account_number,
          account_name: body.account_name,
        },
        select: {
          id: true,
          name: true,
          account_number: true,
          account_name: true,
        },
      });

      await prisma.log.create({
        data: {
          action: 'CREATE',
          reference_id: create.id,
          reference_type: 'BANK',
          user_id,
          description: `${fullname} created a new bank with name ${body.name}`,
        },
      });

      return create;
    });

    return bank;
  }

  async updateBank(
    id: string,
    body: UpdateBankDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.bank.findFirst({
      where: { id, is_deleted: false },
    });

    if (!existing) {
      throw new NotFoundException('Bank not found');
    }

    if (body.name && body.name !== existing.name) {
      const duplicateName = await this.prismaService.bank.findFirst({
        where: { id: { not: id }, name: body.name },
      });

      if (duplicateName) {
        throw new BadRequestException('Bank name already exists');
      }
    }

    if (
      body.account_number &&
      body.account_number !== existing.account_number
    ) {
      const duplicateAccount = await this.prismaService.bank.findFirst({
        where: { id: { not: id }, account_number: body.account_number },
      });

      if (duplicateAccount) {
        throw new BadRequestException('Bank account number already exists');
      }
    }

    const bank = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.bank.update({
        where: { id },
        data: {
          name: body.name,
          account_number: body.account_number,
          account_name: body.account_name,
        },
        select: {
          id: true,
          name: true,
          account_number: true,
          account_name: true,
        },
      });

      const changeInfo = body.name
        ? {
            label: 'bank name',
            before: existing.name,
            after: update.name,
          }
        : body.account_number
          ? {
              label: 'bank account number',
              before: existing.account_number,
              after: update.account_number,
            }
          : body.account_name
            ? {
                label: 'bank account name',
                before: existing.account_name,
                after: update.account_name,
              }
            : {
                label: 'bank details',
                before: existing.name,
                after: update.name,
              };

      await prisma.log.create({
        data: {
          action: 'UPDATE',
          reference_id: id,
          reference_type: 'BANK',
          user_id,
          description: `${fullname} updated ${changeInfo.label} from ${changeInfo.before} to ${changeInfo.after}`,
          details: JSON.stringify({
            before: {
              name: existing.name,
              account_number: existing.account_number,
              account_name: existing.account_name,
            },
            after: {
              name: update.name,
              account_number: update.account_number,
              account_name: update.account_name,
            },
          }),
        },
      });

      return update;
    });

    return bank;
  }

  async deleteBank(id: string, fullname: string, user_id: string) {
    const existing = await this.prismaService.bank.findFirst({
      where: { id, is_deleted: false },
    });

    if (!existing) {
      throw new NotFoundException('Bank not found');
    }

    const deletedAt = new Date();

    const bank = await this.prismaService.$transaction(async (prisma) => {
      const update = await prisma.bank.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: deletedAt,
        },
        select: {
          id: true,
          name: true,
          account_number: true,
          account_name: true,
          is_deleted: true,
          deleted_at: true,
        },
      });

      await prisma.log.create({
        data: {
          action: 'DELETE',
          reference_id: id,
          reference_type: 'BANK',
          user_id,
          description: `${fullname} deleted bank ${existing.name}`,
          details: JSON.stringify({
            before: {
              name: existing.name,
              account_number: existing.account_number,
              account_name: existing.account_name,
              is_deleted: existing.is_deleted,
            },
            after: {
              is_deleted: true,
              deleted_at: deletedAt,
            },
          }),
        },
      });

      return update;
    });

    return bank;
  }

  private generateRandom4Digits(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  private async generateDivisionCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = `PPMID-${this.generateRandom4Digits()}`;
      const existing = await this.prismaService.division.findFirst({
        where: { code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new InternalServerErrorException('Failed to generate division code');
  }

  private async generateRoleCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = `PPMIR-${this.generateRandom4Digits()}`;
      const existing = await this.prismaService.role.findFirst({
        where: { code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new InternalServerErrorException('Failed to generate role code');
  }

  async listUsers(division: string) {
    const AND = [];

    if (!division) {
      AND.push({ is_admin: false });
    } else {
      AND.push({ division: { name: division } }, { is_admin: false });
    }

    const users = await this.prismaService.user.findMany({
      where: {
        AND,
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        created_at: true,
        is_admin: true,
        divisions: {
          select: {
            division: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      created_at: user.created_at,
      is_admin: user.is_admin,
      divisions: user.divisions.map((d) => d.division.name),
    }));
  }

  async getUser(id: string) {
    return this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullname: true,
        email: true,
        created_at: true,
        is_admin: true,
      },
    });
  }

  async updateUser(
    id: string,
    body: UpdateUserDto,
    fullname: string,
    user_id: string,
  ) {
    const existing = await this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        is_admin: true,
        user_roles: {
          select: {
            role_id: true,
          },
        },
        divisions: {
          select: {
            division_id: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (body.email && body.email !== existing.email) {
      const duplicate = await this.prismaService.user.findFirst({
        where: {
          id: { not: id },
          email: body.email,
        },
      });

      if (duplicate) {
        throw new BadRequestException('Email already exists');
      }
    }

    const beforeRoles = existing.user_roles.map((role) => role.role_id);
    const beforeDivisions = existing.divisions.map(
      (division) => division.division_id,
    );
    const nextIsAdmin = body.is_admin ?? existing.is_admin;
    const afterRoles = nextIsAdmin
      ? []
      : Array.isArray(body.roles)
        ? body.roles
        : beforeRoles;
    const afterDivisions = nextIsAdmin
      ? []
      : Array.isArray(body.divisions)
        ? body.divisions
        : beforeDivisions;

    const updatedUser = await this.prismaService.$transaction(
      async (prisma) => {
        const update = await prisma.user.update({
          where: { id },
          data: {
            fullname: body.fullname,
            email: body.email,
            phone: body.phone,
            is_admin: nextIsAdmin,
            password: await hashPassword(body.password),
          },
          select: {
            id: true,
            fullname: true,
            email: true,
            phone: true,
            is_admin: true,
          },
        });

        if (nextIsAdmin) {
          await prisma.userRole.deleteMany({
            where: { user_id: id },
          });
          await prisma.userDivision.deleteMany({
            where: { user_id: id },
          });
        } else {
          if (Array.isArray(body.roles)) {
            await prisma.userRole.deleteMany({
              where: { user_id: id },
            });

            if (body.roles.length > 0) {
              await prisma.userRole.createMany({
                data: body.roles.map((role_id) => ({
                  user_id: id,
                  role_id,
                })),
              });
            }
          }

          if (Array.isArray(body.divisions)) {
            await prisma.userDivision.deleteMany({
              where: { user_id: id },
            });

            if (body.divisions.length > 0) {
              await prisma.userDivision.createMany({
                data: body.divisions.map((division_id) => ({
                  user_id: id,
                  division_id,
                })),
              });
            }
          }
        }

        await prisma.log.create({
          data: {
            action: 'UPDATE',
            reference_id: id,
            reference_type: 'USER',
            user_id,
            description: `${fullname} updated user ${existing.fullname} (${existing.email})`,
            details: JSON.stringify({
              before: {
                fullname: existing.fullname,
                email: existing.email,
                phone: existing.phone,
                is_admin: existing.is_admin,
                roles: beforeRoles,
                divisions: beforeDivisions,
              },
              after: {
                fullname: body.fullname,
                email: body.email,
                phone: body.phone,
                is_admin: nextIsAdmin,
                roles: afterRoles,
                divisions: afterDivisions,
              },
            }),
          },
        });

        return update;
      },
    );

    return updatedUser;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const [
      totalQS,
      activeThisMonthQS,
      activeInvoices,
      pendingApprovalInvoices,
      invoicesThisWeek,
      invoicesLastWeek,
      pendingPayments,
      overduePayments,
      overdueAsOfYesterday,
      completedShipments,
      shipmentsThisWeek,
      shipmentsLastWeek,
    ] = await Promise.all([
      this.prismaService.qS.count({
        where: { is_deleted: false },
      }),

      this.prismaService.qS.count({
        where: {
          is_deleted: false,
          status: { in: [QSSTATUS.SUBMITTED, QSSTATUS.APPROVED] },
          created_at: { gte: startOfThisMonth },
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.VOUCHER] },
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: InvoiceStatus.DRAFT,
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          created_at: { gte: startOfThisWeek },
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          created_at: { gte: startOfLastWeek, lt: startOfThisWeek },
        },
      }),

      this.prismaService.payment.findMany({
        where: {
          payment_status: {
            in: [PaymentStatus.UNPAID, PaymentStatus.INSTALLMENT],
          },
        },
        select: {
          paid_amount: true,
          remaining_amount: true,
          voucher: {
            select: {
              amount: true,
              currency: true,
            },
          },
        },
      }),

      this.prismaService.payment.count({
        where: {
          payment_status: {
            in: [PaymentStatus.UNPAID, PaymentStatus.INSTALLMENT],
          },
          due_date: { lt: now },
        },
      }),

      this.prismaService.payment.count({
        where: {
          payment_status: {
            in: [PaymentStatus.UNPAID, PaymentStatus.INSTALLMENT],
          },
          due_date: { lt: startOfToday },
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: InvoiceStatus.CLOSED,
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: InvoiceStatus.CLOSED,
          updated_at: { gte: startOfThisWeek },
        },
      }),

      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: InvoiceStatus.CLOSED,
          updated_at: { gte: startOfLastWeek, lt: startOfThisWeek },
        },
      }),
    ]);

    const pendingPaymentsTotal = pendingPayments.reduce(
      (sum, p) => sum + p.remaining_amount,
      0,
    );

    const invoiceTrendThisWeek = invoicesThisWeek - invoicesLastWeek;
    const shipmentTrendThisWeek = shipmentsThisWeek - shipmentsLastWeek;

    const overdueTrendSinceYesterday = overduePayments - overdueAsOfYesterday;

    return {
      quotation_sheets: {
        total: totalQS,
        active_this_month: activeThisMonthQS,
      },
      active_invoices: {
        total: activeInvoices,
        pending_approval: pendingApprovalInvoices,
        trend_this_week: invoiceTrendThisWeek,
      },
      pending_payments: {
        total: pendingPayments.length,
        total_value: pendingPaymentsTotal,
      },
      overdue_payments: {
        total: overduePayments,
        trend_since_yesterday: overdueTrendSinceYesterday,
      },
      completed_shipments: {
        total: completedShipments,
        total_processed: completedShipments,
        trend_this_week: shipmentTrendThisWeek,
      },
    };
  }

  async getWorkflowPipeline(): Promise<WorkflowStageResult[]> {
    const now = new Date();

    const [
      qsTotal,
      qsCompleted,
      qsInProgress,
      qsPending,
      invoiceTotal,
      invoiceCompleted,
      invoiceInProgress,
      invoicePending,
      invoiceOverdue,
      voucherTotal,
      voucherCompleted,
      voucherInProgress,
      voucherPending,
      voucherOverdue,
      paymentTotal,
      paymentCompleted,
      paymentInProgress,
      paymentPending,
      paymentOverdue,
      shipmentTotal,
      shipmentCompleted,
      shipmentInProgress,
      shipmentPending,
    ] = await Promise.all([
      this.prismaService.qS.count({
        where: { is_deleted: false },
      }),
      this.prismaService.qS.count({
        where: { is_deleted: false, status: QSSTATUS.APPROVED },
      }),
      this.prismaService.qS.count({
        where: { is_deleted: false, status: QSSTATUS.SUBMITTED },
      }),
      this.prismaService.qS.count({
        where: { is_deleted: false, status: QSSTATUS.DRAFT },
      }),
      this.prismaService.invoice.count({
        where: { is_deleted: false },
      }),
      this.prismaService.invoice.count({
        where: { is_deleted: false, status: InvoiceStatus.CLOSED },
      }),
      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: {
            in: [
              InvoiceStatus.PENDING,
              InvoiceStatus.VOUCHER,
              InvoiceStatus.SHIPPED,
            ],
          },
        },
      }),
      this.prismaService.invoice.count({
        where: { is_deleted: false, status: InvoiceStatus.DRAFT },
      }),
      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          due_date: { lt: now },
          status: { not: InvoiceStatus.CLOSED },
        },
      }),
      this.prismaService.voucher.count({
        where: { is_deleted: false },
      }),
      this.prismaService.voucher.count({
        where: { is_deleted: false, status: VoucherStatus.CLOSED },
      }),
      this.prismaService.voucher.count({
        where: { is_deleted: false, status: VoucherStatus.PENDING },
      }),
      this.prismaService.voucher.count({
        where: { is_deleted: false, status: VoucherStatus.DRAFT },
      }),
      this.prismaService.voucher.count({
        where: {
          is_deleted: false,
          status: { not: VoucherStatus.CLOSED },
          invoice: {
            due_date: { lt: now },
            is_deleted: false,
          },
        },
      }),
      this.prismaService.payment.count(),
      this.prismaService.payment.count({
        where: { payment_status: PaymentStatus.PAID },
      }),
      this.prismaService.payment.count({
        where: { payment_status: PaymentStatus.INSTALLMENT },
      }),
      this.prismaService.payment.count({
        where: { payment_status: PaymentStatus.UNPAID },
      }),
      this.prismaService.payment.count({
        where: {
          due_date: { lt: now },
          payment_status: { not: PaymentStatus.PAID },
        },
      }),

      this.prismaService.documentShipment.count(),
      this.prismaService.documentShipment.count({
        where: { receipt: { isNot: null } },
      }),
      this.prismaService.documentShipment.count({
        where: { receipt: { is: null } },
      }),
      this.prismaService.invoice.count({
        where: {
          is_deleted: false,
          status: InvoiceStatus.SHIPPED,
          shipment: { is: null },
        },
      }),
    ]);

    const buildStage = (
      stage: string,
      total: number,
      completed: number,
      pending: number,
      in_progress: number,
      overdue: number,
    ): WorkflowStageResult => ({
      stage,
      total,
      completed,
      pending,
      in_progress,
      overdue,
      completion_percentage:
        total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
    });

    return [
      buildStage(
        'Quotation Sheet',
        qsTotal,
        qsCompleted,
        qsPending,
        qsInProgress,
        0,
      ),
      buildStage(
        'Invoice',
        invoiceTotal,
        invoiceCompleted,
        invoicePending,
        invoiceInProgress,
        invoiceOverdue,
      ),
      buildStage(
        'Voucher',
        voucherTotal,
        voucherCompleted,
        voucherPending,
        voucherInProgress,
        voucherOverdue,
      ),
      buildStage(
        'Payment',
        paymentTotal,
        paymentCompleted,
        paymentPending,
        paymentInProgress,
        paymentOverdue,
      ),
      buildStage(
        'Shipment',
        shipmentTotal + shipmentPending,
        shipmentCompleted,
        shipmentPending,
        shipmentInProgress,
        0,
      ),
    ];
  }

  async getPaymentDashboard() {
    const today = new Date();

    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);

    const payments = await this.prismaService.payment.findMany({
      where: {
        payment_status: {
          not: PaymentStatus.PAID,
        },
      },
      include: {
        voucher: {
          include: {
            invoice: {
              include: {
                qs: true,
              },
            },
          },
        },
      },
      orderBy: {
        due_date: 'asc',
      },
    });

    const overdue = payments
      .filter((p) => p.due_date < today)
      .map((p) => ({
        paymentId: p.id,
        invoiceId: p.voucher.invoice.id,
        invoiceNumber: p.voucher.invoice.invoice_number,
        vendor: p.voucher.invoice.insured,
        amount: p.remaining_amount,
        dueDate: p.due_date,
        overdueDays: Math.ceil(
          (today.getTime() - p.due_date.getTime()) / (1000 * 60 * 60 * 24),
        ),
        paymentStatus: p.payment_status,
      }));

    const upcoming = payments
      .filter((p) => p.due_date >= today && p.due_date <= next7Days)
      .map((p) => ({
        paymentId: p.id,
        invoiceId: p.voucher.invoice.id,
        invoiceNumber: p.voucher.invoice.invoice_number,
        vendor: p.voucher.invoice.insured,
        amount: p.remaining_amount,
        dueDate: p.due_date,
        dueInDays: Math.ceil(
          (p.due_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        ),
        paymentStatus: p.payment_status,
      }));

    return {
      overdue_count: overdue.length,
      overdue_total_amount: overdue.reduce((sum, item) => sum + item.amount, 0),

      upcoming_count: upcoming.length,
      upcoming_total_amount: upcoming.reduce(
        (sum, item) => sum + item.amount,
        0,
      ),

      overdue_payments: overdue.map((item) => ({
        payment_id: item.paymentId,
        invoice_id: item.invoiceId,
        invoice_number: item.invoiceNumber,
        vendor_name: item.vendor,
        amount: item.amount,
        due_date: item.dueDate,
        overdue_days: item.overdueDays,
        payment_status: item.paymentStatus,
      })),

      upcoming_payments: upcoming.map((item) => ({
        payment_id: item.paymentId,
        invoice_id: item.invoiceId,
        invoice_number: item.invoiceNumber,
        vendor_name: item.vendor,
        amount: item.amount,
        due_date: item.dueDate,
        due_in_days: item.dueInDays,
        payment_status: item.paymentStatus,
      })),
    };
  }

  async getFinanceMonitor() {
    const today = new Date();

    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);

    const [
      overduePayments,
      unpaidInvoices,
      dueWithin7Days,
      activeInstallmentPlans,
      pendingInstallments,
    ] = await Promise.all([
      this.prismaService.payment.aggregate({
        where: {
          payment_status: {
            not: PaymentStatus.PAID,
          },
          due_date: {
            lt: today,
          },
        },
        _count: true,
        _sum: {
          remaining_amount: true,
        },
      }),

      this.prismaService.invoice.aggregate({
        where: {
          status: {
            not: InvoiceStatus.CLOSED,
          },
          is_deleted: false,
        },
        _count: true,
        _sum: {
          amount: true,
        },
      }),

      this.prismaService.payment.aggregate({
        where: {
          payment_status: {
            not: PaymentStatus.PAID,
          },
          due_date: {
            gte: today,
            lte: next7Days,
          },
        },
        _count: true,
        _sum: {
          remaining_amount: true,
        },
      }),

      this.prismaService.payment.groupBy({
        by: ['voucher_id'],
        where: {
          payment_status: PaymentStatus.INSTALLMENT,
        },
      }),

      this.prismaService.payment.count({
        where: {
          payment_status: PaymentStatus.INSTALLMENT,
          remaining_amount: {
            gt: 0,
          },
        },
      }),
    ]);

    return {
      overdue_payments: {
        count: overduePayments._count,
        amount: overduePayments._sum.remaining_amount ?? 0,
      },

      unpaid_invoices: {
        count: unpaidInvoices._count,
        amount: unpaidInvoices._sum.amount ?? 0,
      },

      due_within_7_days: {
        count: dueWithin7Days._count,
        amount: dueWithin7Days._sum.remaining_amount ?? 0,
      },

      active_installments: {
        plans: activeInstallmentPlans.length,
        pending_installments: pendingInstallments,
      },
    };
  }

  parseDetails(details: string | null): {
    division_code: string | null;
    reference_number: string | null;
    title: string | null;
  } {
    if (!details)
      return { division_code: null, reference_number: null, title: null };
    try {
      const parsed = JSON.parse(details);
      return {
        division_code: parsed?.division_code ?? null,
        reference_number: parsed?.reference_number ?? null,
        title: parsed?.title ?? null,
      };
    } catch {
      return { division_code: null, reference_number: null, title: null };
    }
  }

  async getRecentActivities(): Promise<RecentActivityItem[]> {
    const logs = await this.prismaService.log.findMany({
      where: {
        action: {
          notIn: ['LOGIN', 'LOGOUT', 'CLICK'],
        },
        user: {
          divisions: {
            some: {},
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        description: true,
        reference_id: true,
        reference_type: true,
        details: true,
        created_at: true,
        user: {
          select: { fullname: true },
        },
      },
    });

    return logs.map((log) => {
      const { division_code, reference_number, title } = this.parseDetails(
        log.details,
      );

      return {
        id: log.id,
        title: title ?? log.action,
        division_code,
        reference_number: reference_number ?? log.reference_id ?? null,
        description: log.description,
        actor: log.user.fullname,
        action: log.action,
        reference_type: log.reference_type,
        created_at: log.created_at,
      };
    });
  }
}
