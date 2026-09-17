import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';

describe('CargoController', () => {
  let controller: CargoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargoController],
      providers: [{ provide: CargoService, useValue: {} }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CargoController>(CargoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
