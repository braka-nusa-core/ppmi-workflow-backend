import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { PrismaService } from './common/services/prisma.service';
import { StorageService } from './common/services/storage.service';
import { InsuranceTypesModule } from './insurance-types/insurance-types.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { QuotationsModule } from './quotations/quotations.module';
import { UsersModule } from './users/users.module';

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
  exports: [PrismaService, StorageService],
})
export class AppModule {}
