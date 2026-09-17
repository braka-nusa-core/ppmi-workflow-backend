import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../common/services/prisma.service';
import { PniService } from './pni.service';

describe('PniService', () => {
  let service: PniService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PniService,
        { provide: PrismaService, useValue: {} },
        { provide: ClientsService, useValue: {} },
      ],
    }).compile();

    service = module.get<PniService>(PniService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
