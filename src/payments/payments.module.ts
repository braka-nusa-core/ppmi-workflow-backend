import { Module } from '@nestjs/common';
import { IncomingPaymentsController } from './incoming-payments.controller';
import { IncomingPaymentsService } from './incoming-payments.service';
import { OutgoingPaymentsController } from './outgoing-payments.controller';
import { OutgoingPaymentsService } from './outgoing-payments.service';

@Module({
  controllers: [IncomingPaymentsController, OutgoingPaymentsController],
  providers: [IncomingPaymentsService, OutgoingPaymentsService],
})
export class PaymentsModule {}
