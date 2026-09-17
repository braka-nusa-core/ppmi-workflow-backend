import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { HmController } from './hm.controller';
import { HmService } from './hm.service';

describe('HmController', () => {
  let controller: HmController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HmController],
      providers: [{ provide: HmService, useValue: {} }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<HmController>(HmController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
