import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './app.validation';
import { PrismaService } from './common/services/prisma.service';
import { verifyPassword } from './utils/bcrypt.util';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(body: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        fullname: true,
        email: true,
        password: true,
        role: true,
        organization_unit: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!(await verifyPassword(body.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.log.create({
      data: {
        action: 'LOGIN',
        reference_id: user.id,
        reference_type: 'USER_MANAGEMENT',
        user_id: user.id,
        description: `${user.fullname} logged in`,
      },
    });

    return {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      organization_unit: user.organization_unit?.name ?? null,
      access_token: await this.jwt.signAsync({
        fullname: user.fullname,
        sub: user.id,
        role: user.role,
      }),
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        role: true,
        organization_unit: {
          select: {
            id: true,
            name: true,
            type: true,
            permissions: {
              select: {
                permission: { select: { resource: true, action: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const isAdmin = user.role === 'SUPERADMIN';

    return {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organization_unit: user.organization_unit
        ? user.organization_unit.name
        : null,
      permissions: isAdmin
        ? null
        : (user.organization_unit?.permissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ) ?? []),
    };
  }
}
