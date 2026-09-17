import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../common/services/prisma.service';
import { QuotationsService } from '../quotations/quotations.service';
import { HmService } from './hm.service';

describe('HmService', () => {
  let service: HmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HmService,
        { provide: PrismaService, useValue: {} },
        { provide: QuotationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<HmService>(HmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
