import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service';
import { PrismaService } from './common/services/prisma.service';
import { hashPassword } from './utils/bcrypt.util';

vi.mock('./utils/bcrypt.util', () => ({
  hashPassword: vi.fn(),
}));

describe('AppService', () => {
  let service: AppService;
  const prismaMock = {
    division: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bank: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    userRole: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    userDivision: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    log: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    qS: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    payment: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    voucher: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    documentShipment: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AppService>(AppService);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists divisions ordered by name', async () => {
    prismaMock.division.findMany.mockResolvedValue([{ id: 'div-1' }]);

    const result = await service.listDivisions();

    expect(prismaMock.division.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([{ id: 'div-1' }]);
  });

  it('gets division by id', async () => {
    prismaMock.division.findUnique.mockResolvedValue({ id: 'div-1' });

    const result = await service.getDivision('div-1');

    expect(prismaMock.division.findUnique).toHaveBeenCalledWith({
      where: { id: 'div-1' },
    });
    expect(result).toEqual({ id: 'div-1' });
  });

  it('creates division when not duplicate', async () => {
    prismaMock.division.findFirst.mockResolvedValue(null);
    prismaMock.division.create.mockResolvedValue({
      id: 'div-1',
      code: 'PPMID-1234',
      name: 'P&I',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.createDivision(
      { name: 'P&I' },
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.division.findFirst).toHaveBeenCalled();
    expect(prismaMock.division.create).toHaveBeenCalledWith({
      data: {
        code: expect.stringMatching(/^PPMID-\d{4}$/),
        name: 'P&I',
        description: undefined,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'CREATE',
        reference_id: 'div-1',
        reference_type: 'DIVISION',
        user_id: 'admin-1',
        description: 'Super Admin created a new division with name P&I',
      },
    });
    expect(result).toEqual({ id: 'div-1', code: 'PPMID-1234', name: 'P&I' });
  });

  it('rejects create when name duplicate', async () => {
    prismaMock.division.findFirst.mockResolvedValue({ id: 'div-1' });

    await expect(
      service.createDivision({ name: 'P&I' }, 'Super Admin', 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update when division missing', async () => {
    prismaMock.division.findUnique.mockResolvedValue(null);

    await expect(
      service.updateDivision(
        'div-1',
        { name: 'P&I' },
        'Super Admin',
        'admin-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects update when name duplicate', async () => {
    prismaMock.division.findUnique.mockResolvedValue({ id: 'div-1' });
    prismaMock.division.findFirst.mockResolvedValue({ id: 'div-2' });

    await expect(
      service.updateDivision(
        'div-1',
        { name: 'P&I' },
        'Super Admin',
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates division when valid', async () => {
    prismaMock.division.findUnique.mockResolvedValue({
      id: 'div-1',
      name: 'P&I',
      description: 'Old',
    });
    prismaMock.division.findFirst.mockResolvedValue(null);
    prismaMock.division.update.mockResolvedValue({
      id: 'div-1',
      code: 'PPMID-1234',
      name: 'P&I Updated',
      description: 'New',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.updateDivision(
      'div-1',
      { name: 'P&I Updated' },
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.division.update).toHaveBeenCalledWith({
      where: { id: 'div-1' },
      data: {
        name: 'P&I Updated',
        description: undefined,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'UPDATE',
        reference_id: 'div-1',
        reference_type: 'DIVISION',
        user_id: 'admin-1',
        description: expect.stringContaining('Super Admin updated a'),
        details: expect.any(String),
      },
    });
    expect(result).toEqual({
      id: 'div-1',
      code: 'PPMID-1234',
      name: 'P&I Updated',
      description: 'New',
    });
  });

  it('lists roles ordered by name', async () => {
    prismaMock.role.findMany.mockResolvedValue([{ id: 'role-1' }]);

    const result = await service.listRoles();

    expect(prismaMock.role.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([{ id: 'role-1' }]);
  });

  it('gets role by id', async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: 'role-1' });

    const result = await service.getRole('role-1');

    expect(prismaMock.role.findUnique).toHaveBeenCalledWith({
      where: { id: 'role-1' },
    });
    expect(result).toEqual({ id: 'role-1' });
  });

  it('creates role when not duplicate', async () => {
    prismaMock.role.findFirst.mockResolvedValue(null);
    prismaMock.role.create.mockResolvedValue({
      id: 'role-1',
      code: 'PPMIR-1234',
      name: 'Editor',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.createRole(
      { name: 'Editor' },
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.role.findFirst).toHaveBeenCalled();
    expect(prismaMock.role.create).toHaveBeenCalledWith({
      data: {
        code: expect.stringMatching(/^PPMIR-\d{4}$/),
        name: 'Editor',
        description: undefined,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'CREATE',
        reference_id: 'role-1',
        reference_type: 'ROLE',
        user_id: 'admin-1',
        description: 'Super Admin created a new role with name Editor',
      },
    });
    expect(result).toEqual({
      id: 'role-1',
      code: 'PPMIR-1234',
      name: 'Editor',
    });
  });

  it('rejects create when role name duplicate', async () => {
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-1' });

    await expect(
      service.createRole({ name: 'Editor' }, 'Super Admin', 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update when role missing', async () => {
    prismaMock.role.findUnique.mockResolvedValue(null);

    await expect(
      service.updateRole(
        'role-1',
        { name: 'Editor' },
        'Super Admin',
        'admin-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects update when role name duplicate', async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: 'role-1' });
    prismaMock.role.findFirst.mockResolvedValue({ id: 'role-2' });

    await expect(
      service.updateRole(
        'role-1',
        { name: 'Editor' },
        'Super Admin',
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates role when valid', async () => {
    prismaMock.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'Editor',
      description: 'Old',
    });
    prismaMock.role.findFirst.mockResolvedValue(null);
    prismaMock.role.update.mockResolvedValue({
      id: 'role-1',
      code: 'PPMIR-1234',
      name: 'Editor Updated',
      description: 'New',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.updateRole(
      'role-1',
      { name: 'Editor Updated' },
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: {
        name: 'Editor Updated',
        description: undefined,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'UPDATE',
        reference_id: 'role-1',
        reference_type: 'ROLE',
        user_id: 'admin-1',
        description: expect.stringContaining('Super Admin updated a'),
        details: expect.any(String),
      },
    });
    expect(result).toEqual({
      id: 'role-1',
      code: 'PPMIR-1234',
      name: 'Editor Updated',
      description: 'New',
    });
  });

  it('lists banks ordered by name', async () => {
    prismaMock.bank.findMany.mockResolvedValue([{ id: 'bank-1' }]);

    const result = await service.listBanks();

    expect(prismaMock.bank.findMany).toHaveBeenCalledWith({
      where: { is_deleted: false },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([{ id: 'bank-1' }]);
  });

  it('gets bank by id', async () => {
    prismaMock.bank.findFirst.mockResolvedValue({ id: 'bank-1' });

    const result = await service.getBank('bank-1');

    expect(prismaMock.bank.findFirst).toHaveBeenCalledWith({
      where: { id: 'bank-1', is_deleted: false },
    });
    expect(result).toEqual({ id: 'bank-1' });
  });

  it('creates bank when not duplicate', async () => {
    prismaMock.bank.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.bank.create.mockResolvedValue({
      id: 'bank-1',
      name: 'Bank A',
      account_number: '123',
      account_name: 'PPMI',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.createBank(
      {
        name: 'Bank A',
        account_number: '123',
        account_name: 'PPMI',
      },
      'User One',
      'user-1',
    );

    expect(prismaMock.bank.create).toHaveBeenCalledWith({
      data: {
        name: 'Bank A',
        account_number: '123',
        account_name: 'PPMI',
      },
      select: {
        id: true,
        name: true,
        account_number: true,
        account_name: true,
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'CREATE',
        reference_id: 'bank-1',
        reference_type: 'BANK',
        user_id: 'user-1',
        description: 'User One created a new bank with name Bank A',
      },
    });
    expect(result).toEqual({
      id: 'bank-1',
      name: 'Bank A',
      account_number: '123',
      account_name: 'PPMI',
    });
  });

  it('rejects create when bank name duplicate', async () => {
    prismaMock.bank.findFirst.mockResolvedValue({ id: 'bank-1' });

    await expect(
      service.createBank(
        {
          name: 'Bank A',
          account_number: '123',
          account_name: 'PPMI',
        },
        'User One',
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects create when bank account number duplicate', async () => {
    prismaMock.bank.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'bank-1' });

    await expect(
      service.createBank(
        {
          name: 'Bank A',
          account_number: '123',
          account_name: 'PPMI',
        },
        'User One',
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update when bank missing', async () => {
    prismaMock.bank.findFirst.mockResolvedValue(null);

    await expect(
      service.updateBank('bank-1', { name: 'Bank A' }, 'User One', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects update when bank name duplicate', async () => {
    prismaMock.bank.findFirst
      .mockResolvedValueOnce({
        id: 'bank-1',
        name: 'Bank A',
        account_number: '123',
        account_name: 'PPMI',
      })
      .mockResolvedValueOnce({ id: 'bank-2' });

    await expect(
      service.updateBank('bank-1', { name: 'Bank B' }, 'User One', 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects update when bank account number duplicate', async () => {
    prismaMock.bank.findFirst
      .mockResolvedValueOnce({
        id: 'bank-1',
        name: 'Bank A',
        account_number: '123',
        account_name: 'PPMI',
      })
      .mockResolvedValueOnce({ id: 'bank-2' });

    await expect(
      service.updateBank(
        'bank-1',
        { account_number: '999' },
        'User One',
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates bank when valid', async () => {
    prismaMock.bank.findFirst
      .mockResolvedValueOnce({
        id: 'bank-1',
        name: 'Bank A',
        account_number: '123',
        account_name: 'PPMI',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.bank.update.mockResolvedValue({
      id: 'bank-1',
      name: 'Bank A Updated',
      account_number: '999',
      account_name: 'PPMI Updated',
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.updateBank(
      'bank-1',
      {
        name: 'Bank A Updated',
        account_number: '999',
        account_name: 'PPMI Updated',
      },
      'User One',
      'user-1',
    );

    expect(prismaMock.bank.update).toHaveBeenCalledWith({
      where: { id: 'bank-1' },
      data: {
        name: 'Bank A Updated',
        account_number: '999',
        account_name: 'PPMI Updated',
      },
      select: {
        id: true,
        name: true,
        account_number: true,
        account_name: true,
      },
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'UPDATE',
        reference_id: 'bank-1',
        reference_type: 'BANK',
        user_id: 'user-1',
        description: 'User One updated bank name from Bank A to Bank A Updated',
        details: expect.any(String),
      },
    });
    expect(result).toEqual({
      id: 'bank-1',
      name: 'Bank A Updated',
      account_number: '999',
      account_name: 'PPMI Updated',
    });
  });

  it('soft deletes bank when valid', async () => {
    prismaMock.bank.findFirst.mockResolvedValue({
      id: 'bank-1',
      name: 'Bank A',
      account_number: '123',
      account_name: 'PPMI',
      is_deleted: false,
    });
    prismaMock.bank.update.mockResolvedValue({
      id: 'bank-1',
      name: 'Bank A',
      account_number: '123',
      account_name: 'PPMI',
      is_deleted: true,
      deleted_at: new Date('2024-01-03T00:00:00.000Z'),
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.deleteBank('bank-1', 'User One', 'user-1');

    expect(prismaMock.bank.update).toHaveBeenCalledWith({
      where: { id: 'bank-1' },
      data: {
        is_deleted: true,
        deleted_at: expect.any(Date),
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
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'DELETE',
        reference_id: 'bank-1',
        reference_type: 'BANK',
        user_id: 'user-1',
        description: 'User One deleted bank Bank A',
        details: expect.any(String),
      },
    });
    expect(result).toEqual({
      id: 'bank-1',
      name: 'Bank A',
      account_number: '123',
      account_name: 'PPMI',
      is_deleted: true,
      deleted_at: new Date('2024-01-03T00:00:00.000Z'),
    });
  });

  it('lists users by division when provided', async () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        fullname: 'User One',
        email: 'user1@example.com',
        created_at: createdAt,
        is_admin: false,
        divisions: [
          { division: { name: 'P&I' } },
          { division: { name: 'Marine' } },
        ],
      },
    ]);

    const result = await service.listUsers('P&I');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ division: { name: 'P&I' } }, { is_admin: false }],
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
    expect(result).toEqual([
      {
        id: 'user-1',
        fullname: 'User One',
        email: 'user1@example.com',
        created_at: createdAt,
        is_admin: false,
        divisions: ['P&I', 'Marine'],
      },
    ]);
  });

  it('lists users when division is not provided', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await service.listUsers('');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ is_admin: false }],
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
    expect(result).toEqual([]);
  });

  it('gets user detail', async () => {
    const createdAt = new Date('2024-01-02T00:00:00.000Z');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      fullname: 'User One',
      email: 'user1@example.com',
      created_at: createdAt,
      is_admin: false,
    });

    const result = await service.getUser('user-1');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        fullname: true,
        email: true,
        created_at: true,
        is_admin: true,
      },
    });
    expect(result).toEqual({
      id: 'user-1',
      fullname: 'User One',
      email: 'user1@example.com',
      created_at: createdAt,
      is_admin: false,
    });
  });

  it('rejects update user when missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updateUser(
        'user-1',
        {
          fullname: 'User Updated',
          email: 'user@example.com',
          password: 'secret123',
        },
        'Super Admin',
        'admin-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates user with roles and divisions', async () => {
    vi.mocked(hashPassword).mockResolvedValue('hashed');
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      fullname: 'User One',
      email: 'user1@example.com',
      phone: '08123',
      is_admin: false,
      user_roles: [{ role_id: 'role-old' }],
      divisions: [{ division_id: 'div-old' }],
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({
      id: 'user-1',
      fullname: 'User Updated',
      email: 'user@example.com',
      phone: '081234567890',
      is_admin: false,
    });
    prismaMock.log.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.updateUser(
      'user-1',
      {
        fullname: 'User Updated',
        email: 'user@example.com',
        password: 'secret123',
        phone: '081234567890',
        is_admin: false,
        divisions: ['div-1'],
        roles: ['role-1'],
      },
      'Super Admin',
      'admin-1',
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        fullname: 'User Updated',
        email: 'user@example.com',
        phone: '081234567890',
        is_admin: false,
        password: 'hashed',
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        is_admin: true,
      },
    });
    expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
    expect(prismaMock.userRole.createMany).toHaveBeenCalledWith({
      data: [{ user_id: 'user-1', role_id: 'role-1' }],
    });
    expect(prismaMock.userDivision.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
    expect(prismaMock.userDivision.createMany).toHaveBeenCalledWith({
      data: [{ user_id: 'user-1', division_id: 'div-1' }],
    });
    expect(prismaMock.log.create).toHaveBeenCalledWith({
      data: {
        action: 'UPDATE',
        reference_id: 'user-1',
        reference_type: 'USER',
        user_id: 'admin-1',
        description: 'Super Admin updated user User One (user1@example.com)',
        details: expect.any(String),
      },
    });
    expect(result).toEqual({
      id: 'user-1',
      fullname: 'User Updated',
      email: 'user@example.com',
      phone: '081234567890',
      is_admin: false,
    });
  });

  describe('getDashboardStats', () => {
    it('should compute and return dashboard stats', async () => {
      prismaMock.qS.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
      prismaMock.invoice.count
        .mockResolvedValueOnce(5) // activeInvoices
        .mockResolvedValueOnce(1) // pendingApprovalInvoices
        .mockResolvedValueOnce(4) // invoicesThisWeek
        .mockResolvedValueOnce(2) // invoicesLastWeek
        .mockResolvedValueOnce(8) // completedShipments
        .mockResolvedValueOnce(3) // shipmentsThisWeek
        .mockResolvedValueOnce(1); // shipmentsLastWeek
      prismaMock.payment.findMany.mockResolvedValue([
        {
          paid_amount: 1000,
          remaining_amount: 4000,
          voucher: { amount: 5000, currency: 'USD' },
        },
        {
          paid_amount: 0,
          remaining_amount: 2000,
          voucher: { amount: 2000, currency: 'USD' },
        },
      ]);
      prismaMock.payment.count
        .mockResolvedValueOnce(2) // overduePayments
        .mockResolvedValueOnce(1); // overdueAsOfYesterday

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        quotation_sheets: { total: 10, active_this_month: 3 },
        active_invoices: { total: 5, pending_approval: 1, trend_this_week: 2 },
        pending_payments: { total: 2, total_value: 6000 },
        overdue_payments: { total: 2, trend_since_yesterday: 1 },
        completed_shipments: {
          total: 8,
          total_processed: 8,
          trend_this_week: 2,
        },
      });
    });
  });

  describe('getWorkflowPipeline', () => {
    it('should query and return workflow pipeline stages', async () => {
      prismaMock.qS.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(1) // in_progress
        .mockResolvedValueOnce(1); // pending
      prismaMock.invoice.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(3) // in_progress
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(1); // overdue
      prismaMock.voucher.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // completed
        .mockResolvedValueOnce(1) // in_progress
        .mockResolvedValueOnce(1) // pending
        .mockResolvedValueOnce(0); // overdue
      prismaMock.payment.count
        .mockResolvedValueOnce(8) // total
        .mockResolvedValueOnce(4) // completed
        .mockResolvedValueOnce(2) // in_progress
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(1); // overdue
      prismaMock.documentShipment.count
        .mockResolvedValueOnce(6) // total
        .mockResolvedValueOnce(4) // completed
        .mockResolvedValueOnce(2); // in_progress
      prismaMock.invoice.count.mockResolvedValueOnce(1); // shipmentPending

      const result = await service.getWorkflowPipeline();

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        stage: 'Quotation Sheet',
        total: 10,
        completed: 8,
        pending: 1,
        in_progress: 1,
        overdue: 0,
        completion_percentage: 80,
      });
      expect(result[1].stage).toBe('Invoice');
      expect(result[2].stage).toBe('Voucher');
      expect(result[3].stage).toBe('Payment');
      expect(result[4].stage).toBe('Shipment');
    });
  });

  describe('getPaymentDashboard', () => {
    it('should compute payment dashboard data', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      prismaMock.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          remaining_amount: 4000,
          due_date: pastDate,
          payment_status: 'UNPAID',
          voucher: {
            invoice: {
              id: 'inv-1',
              invoice_number: 'INV-001',
              insured: 'Insured A',
              qs: {},
            },
          },
        },
        {
          id: 'pay-2',
          remaining_amount: 2000,
          due_date: futureDate,
          payment_status: 'INSTALLMENT',
          voucher: {
            invoice: {
              id: 'inv-2',
              invoice_number: 'INV-002',
              insured: 'Insured B',
              qs: {},
            },
          },
        },
      ]);

      const result = await service.getPaymentDashboard();

      expect(result.overdue_count).toBe(1);
      expect(result.overdue_total_amount).toBe(4000);
      expect(result.upcoming_count).toBe(1);
      expect(result.upcoming_total_amount).toBe(2000);
      expect(result.overdue_payments[0].payment_id).toBe('pay-1');
      expect(result.upcoming_payments[0].payment_id).toBe('pay-2');
    });
  });

  describe('getFinanceMonitor', () => {
    it('should aggregate financial metrics', async () => {
      prismaMock.payment.aggregate
        .mockResolvedValueOnce({
          _count: 2,
          _sum: { remaining_amount: 6000 },
        }) // overduePayments
        .mockResolvedValueOnce({
          _count: 3,
          _sum: { remaining_amount: 8000 },
        }); // dueWithin7Days

      prismaMock.invoice.aggregate.mockResolvedValue({
        _count: 5,
        _sum: { amount: 25000 },
      }); // unpaidInvoices

      prismaMock.payment.groupBy.mockResolvedValue([
        { voucher_id: 'v-1' },
        { voucher_id: 'v-2' },
      ]); // activeInstallmentPlans

      prismaMock.payment.count.mockResolvedValue(4); // pendingInstallments

      const result = await service.getFinanceMonitor();

      expect(result).toEqual({
        overdue_payments: { count: 2, amount: 6000 },
        unpaid_invoices: { count: 5, amount: 25000 },
        due_within_7_days: { count: 3, amount: 8000 },
        active_installments: { plans: 2, pending_installments: 4 },
      });
    });
  });

  describe('getRecentActivities', () => {
    it('should query log actions and map recent activity items', async () => {
      const logDate = new Date();
      prismaMock.log.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'CREATE',
          description: 'User created QS-1',
          reference_id: 'QS-1',
          reference_type: 'QS',
          details: JSON.stringify({
            division_code: 'DIV',
            reference_number: 'QS-1',
            title: 'Create Quotation Sheet',
          }),
          created_at: logDate,
          user: { fullname: 'Full Name' },
        },
      ]);

      const result = await service.getRecentActivities();

      expect(result).toEqual([
        {
          id: 'log-1',
          title: 'Create Quotation Sheet',
          division_code: 'DIV',
          reference_number: 'QS-1',
          description: 'User created QS-1',
          actor: 'Full Name',
          action: 'CREATE',
          reference_type: 'QS',
          created_at: logDate,
        },
      ]);
    });
  });
});
