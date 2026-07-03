import { Module } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService, PrismaService],
})
export class ShipmentsModule {}
