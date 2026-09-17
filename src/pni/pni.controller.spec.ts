import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PniController } from './pni.controller';
import { PniService } from './pni.service';

describe('PniController', () => {
  let controller: PniController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PniController],
      providers: [{ provide: PniService, useValue: {} }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PniController>(PniController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
