import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestInvoicesController } from './request-invoices.controller';
import { RequestInvoicesService } from './request-invoices.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RequestInvoicesController],
  providers: [RequestInvoicesService],
})
export class RequestInvoicesModule {}
