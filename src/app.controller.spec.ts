import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserGuard } from './common/guards/user.guard';

describe('AppController', () => {
  let controller: AppController;
  const appServiceMock = {
    listDivisions: vi.fn(),
    getDivision: vi.fn(),
    createDivision: vi.fn(),
    updateDivision: vi.fn(),
    listRoles: vi.fn(),
    getRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    listBanks: vi.fn(),
    getBank: vi.fn(),
    createBank: vi.fn(),
    updateBank: vi.fn(),
    deleteBank: vi.fn(),
    listUsers: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    getDashboardStats: vi.fn(),
    getWorkflowPipeline: vi.fn(),
    getRecentActivities: vi.fn(),
    getFinanceMonitor: vi.fn(),
    getPaymentDashboard: vi.fn(),
  };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appServiceMock }],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(UserGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AppController>(AppController);
    vi.clearAllMocks();
  });

  it('returns index response', () => {
    const result = controller.index();

    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      message: 'PPMI Workflow Dev API',
    });
  });

  it('returns division list response', async () => {
    appServiceMock.listDivisions.mockResolvedValue([{ id: 'div-1' }]);

    const result = await controller.listDivisions();

    expect(appServiceMock.listDivisions).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: [{ id: 'div-1' }],
    });
  });

  it('returns division detail response', async () => {
    appServiceMock.getDivision.mockResolvedValue({ id: 'div-1' });

    const result = await controller.getDivision('div-1');

    expect(appServiceMock.getDivision).toHaveBeenCalledWith('div-1');
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'div-1' },
    });
  });

  it('returns create division response', async () => {
    appServiceMock.createDivision.mockResolvedValue({ id: 'div-1' });

    const result = await controller.createDivision({ name: 'P&I' }, {
      credentials: { fullname: 'Super Admin', id: 'admin-1' },
    } as any);

    expect(appServiceMock.createDivision).toHaveBeenCalledWith(
      { name: 'P&I' },
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.CREATED,
      data: { id: 'div-1' },
    });
  });

  it('returns update division response', async () => {
    appServiceMock.updateDivision.mockResolvedValue({ id: 'div-1' });

    const result = await controller.updateDivision(
      'div-1',
      { name: 'P&I Updated' },
      { credentials: { fullname: 'Super Admin', id: 'admin-1' } } as any,
    );

    expect(appServiceMock.updateDivision).toHaveBeenCalledWith(
      'div-1',
      { name: 'P&I Updated' },
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'div-1' },
    });
  });

  it('returns role list response', async () => {
    appServiceMock.listRoles.mockResolvedValue([{ id: 'role-1' }]);

    const result = await controller.listRoles();

    expect(appServiceMock.listRoles).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: [{ id: 'role-1' }],
    });
  });

  it('returns role detail response', async () => {
    appServiceMock.getRole.mockResolvedValue({ id: 'role-1' });

    const result = await controller.getRole('role-1');

    expect(appServiceMock.getRole).toHaveBeenCalledWith('role-1');
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'role-1' },
    });
  });

  it('returns create role response', async () => {
    appServiceMock.createRole.mockResolvedValue({ id: 'role-1' });

    const result = await controller.createRole({ name: 'Editor' }, {
      credentials: { fullname: 'Super Admin', id: 'admin-1' },
    } as any);

    expect(appServiceMock.createRole).toHaveBeenCalledWith(
      { name: 'Editor' },
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.CREATED,
      data: { id: 'role-1' },
    });
  });

  it('returns update role response', async () => {
    appServiceMock.updateRole.mockResolvedValue({ id: 'role-1' });

    const result = await controller.updateRole(
      'role-1',
      { name: 'Editor Updated' },
      { credentials: { fullname: 'Super Admin', id: 'admin-1' } } as any,
    );

    expect(appServiceMock.updateRole).toHaveBeenCalledWith(
      'role-1',
      { name: 'Editor Updated' },
      'Super Admin',
      'admin-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'role-1' },
    });
  });

  it('returns bank list response', async () => {
    appServiceMock.listBanks.mockResolvedValue([{ id: 'bank-1' }]);

    const result = await controller.listBanks();

    expect(appServiceMock.listBanks).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: [{ id: 'bank-1' }],
    });
  });

  it('returns bank detail response', async () => {
    appServiceMock.getBank.mockResolvedValue({ id: 'bank-1' });

    const result = await controller.getBank('bank-1');

    expect(appServiceMock.getBank).toHaveBeenCalledWith('bank-1');
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'bank-1' },
    });
  });

  it('returns create bank response', async () => {
    appServiceMock.createBank.mockResolvedValue({ id: 'bank-1' });

    const result = await controller.createBank(
      {
        name: 'Bank A',
        account_number: '1234567890',
        account_name: 'PPMI',
      },
      { credentials: { fullname: 'User One', id: 'user-1' } } as any,
    );

    expect(appServiceMock.createBank).toHaveBeenCalledWith(
      {
        name: 'Bank A',
        account_number: '1234567890',
        account_name: 'PPMI',
      },
      'User One',
      'user-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.CREATED,
      data: { id: 'bank-1' },
    });
  });

  it('returns update bank response', async () => {
    appServiceMock.updateBank.mockResolvedValue({ id: 'bank-1' });

    const result = await controller.updateBank(
      'bank-1',
      {
        name: 'Bank A Updated',
        account_number: '0987654321',
        account_name: 'PPMI Updated',
      },
      { credentials: { fullname: 'User One', id: 'user-1' } } as any,
    );

    expect(appServiceMock.updateBank).toHaveBeenCalledWith(
      'bank-1',
      {
        name: 'Bank A Updated',
        account_number: '0987654321',
        account_name: 'PPMI Updated',
      },
      'User One',
      'user-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'bank-1' },
    });
  });

  it('returns delete bank response', async () => {
    appServiceMock.deleteBank.mockResolvedValue({ id: 'bank-1' });

    const result = await controller.deleteBank('bank-1', {
      credentials: { fullname: 'User One', id: 'user-1' },
    } as any);

    expect(appServiceMock.deleteBank).toHaveBeenCalledWith(
      'bank-1',
      'User One',
      'user-1',
    );
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'bank-1' },
    });
  });

  it('returns users list response', async () => {
    appServiceMock.listUsers.mockResolvedValue([{ id: 'user-1' }]);

    const result = await controller.listUsers({ division: 'P&I' });

    expect(appServiceMock.listUsers).toHaveBeenCalledWith('P&I');
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: [{ id: 'user-1' }],
    });
  });

  it('returns user detail response', async () => {
    appServiceMock.getUser.mockResolvedValue({ id: 'user-1' });

    const result = await controller.getUser('user-1');

    expect(appServiceMock.getUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'user-1' },
    });
  });

  it('returns update user response', async () => {
    appServiceMock.updateUser.mockResolvedValue({ id: 'user-1' });

    const result = await controller.updateUser(
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
      { credentials: { fullname: 'Super Admin', id: 'admin-1' } } as any,
    );

    expect(appServiceMock.updateUser).toHaveBeenCalledWith(
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
    expect(result).toEqual({
      success: true,
      status_code: HttpStatus.OK,
      data: { id: 'user-1' },
    });
  });

  describe('getDashboardStats', () => {
    it('returns dashboard stats response', async () => {
      const statsMock = {
        quotation_sheets: { total: 10, active_this_month: 2 },
        active_invoices: { total: 5, pending_approval: 1, trend_this_week: 1 },
        pending_payments: { total: 3, total_value: 15000 },
        overdue_payments: { total: 1, trend_since_yesterday: 0 },
        completed_shipments: {
          total: 8,
          total_processed: 8,
          trend_this_week: 2,
        },
      };
      appServiceMock.getDashboardStats.mockResolvedValue(statsMock);

      const result = await controller.getDashboardStats();

      expect(appServiceMock.getDashboardStats).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        status_code: HttpStatus.OK,
        data: statsMock,
      });
    });
  });

  describe('getWorkflowPipeline', () => {
    it('returns workflow workspace response', async () => {
      const pipelineMock = [
        {
          stage: 'Quotation Sheet',
          total: 10,
          completed: 8,
          pending: 2,
          in_progress: 0,
          overdue: 0,
          completion_percentage: 80,
        },
      ];
      const recentsMock = [
        {
          id: 'log-1',
          title: 'CREATE',
          division_code: 'DIV',
          reference_number: '123',
          description: 'desc',
          actor: 'User',
          action: 'CREATE',
          reference_type: 'QS',
          created_at: new Date(),
        },
      ];
      const financesMock = {
        overdue_payments: { count: 1, amount: 5000 },
        unpaid_invoices: { count: 2, amount: 10000 },
        due_within_7_days: { count: 1, amount: 2000 },
        active_installments: { plans: 1, pending_installments: 1 },
      };
      const paymentsMock = {
        overdue_count: 1,
        overdue_total_amount: 5000,
        upcoming_count: 1,
        upcoming_total_amount: 2000,
        overdue_payments: [],
        upcoming_payments: [],
      };

      appServiceMock.getWorkflowPipeline.mockResolvedValue(pipelineMock);
      appServiceMock.getRecentActivities.mockResolvedValue(recentsMock);
      appServiceMock.getFinanceMonitor.mockResolvedValue(financesMock);
      appServiceMock.getPaymentDashboard.mockResolvedValue(paymentsMock);

      const result = await controller.getWorkflowPipeline();

      expect(appServiceMock.getWorkflowPipeline).toHaveBeenCalled();
      expect(appServiceMock.getRecentActivities).toHaveBeenCalled();
      expect(appServiceMock.getFinanceMonitor).toHaveBeenCalled();
      expect(appServiceMock.getPaymentDashboard).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        status_code: HttpStatus.OK,
        data: {
          workflows: pipelineMock,
          recents: recentsMock,
          finances: financesMock,
          payments: paymentsMock,
        },
      });
    });
  });
});
