import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/services/prisma.service';
import { StorageService } from './common/services/storage.service';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { InsuranceTypesModule } from './insurance-types/insurance-types.module';
import { QuotationsModule } from './quotations/quotations.module';

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
    QuotationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, StorageService],
  exports: [PrismaService],
})
export class AppModule {}
