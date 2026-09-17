import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../common/services/prisma.service';
import { QuotationsService } from '../quotations/quotations.service';
import { CargoService } from './cargo.service';

describe('CargoService', () => {
  let service: CargoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargoService,
        { provide: PrismaService, useValue: {} },
        { provide: QuotationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<CargoService>(CargoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
