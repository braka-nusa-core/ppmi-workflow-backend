import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { PrismaService } from './common/services/prisma.service';
import { StorageService } from './common/services/storage.service';
import { ClubsModule } from './clubs/clubs.module';
import { VesselsModule } from './vessels/vessels.module';
import { VesselPoliciesModule } from './vessel-policies/vessel-policies.module';
import { InsuranceTypesModule } from './insurance-types/insurance-types.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { QuotationsModule } from './quotations/quotations.module';
import { UsersModule } from './users/users.module';
import { PniModule } from './pni/pni.module';
import { HmModule } from './hm/hm.module';
import { CargoModule } from './cargo/cargo.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { MeetingsModule } from './meetings/meetings.module';
import { InsuranceCompaniesModule } from './insurance-companies/insurance-companies.module';
import { PoliciesModule } from './policies/policies.module';
import { RequestInvoicesModule } from './request-invoices/request-invoices.module';
import { BanksModule } from './banks/banks.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { QsOptionsModule } from './qs-options/qs-options.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '6h',
      },
    }),
    UsersModule,
    OrganizationsModule,
    ClientsModule,
    InsuranceTypesModule,
    ClubsModule,
    VesselsModule,
    VesselPoliciesModule,
    QuotationsModule,
    PniModule,
    HmModule,
    CargoModule,
    NotificationsModule,
    AssignmentsModule,
    MeetingsModule,
    InsuranceCompaniesModule,
    PoliciesModule,
    RequestInvoicesModule,
    BanksModule,
    InvoicesModule,
    PaymentsModule,
    ShipmentsModule,
    QsOptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, StorageService],
  exports: [PrismaService, StorageService],
})
export class AppModule {}
