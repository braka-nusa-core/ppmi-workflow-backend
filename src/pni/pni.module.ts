import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { PniService } from './pni.service';
import { PniController } from './pni.controller';

@Module({
  imports: [ClientsModule],
  controllers: [PniController],
  providers: [PniService],
})
export class PniModule {}
