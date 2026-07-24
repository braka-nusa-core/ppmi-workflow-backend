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
        created_at: true,
        updated_at: true,
        organization_unit: {
          select: {
            name: true,
            type: true,
            permissions: {
              select: {
                permission: { select: { resource: true, action: true } },
              },
            },
            parent: {
              select: {
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
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const { organization_unit: unit, ...userData } = user;
    const isAdmin = userData.role === 'SUPERADMIN';

    const permissionSource = unit?.type === 'DEPARTMENT' ? unit.parent : unit;

    return {
      ...userData,
      organization_unit: unit
        ? {
            name: unit.name,
            type: unit.type,
            parent: unit.parent
              ? { name: unit.parent.name, type: unit.parent.type }
              : null,
          }
        : null,
      permissions: isAdmin
        ? null
        : (permissionSource?.permissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ) ?? []),
    };
  }
}
