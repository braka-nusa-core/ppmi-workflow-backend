import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.credentials;

    if (user.role === 'SUPERADMIN') return true;

    const hasPermission = await this.prisma.permission.findFirst({
      where: {
        resource: permission.resource,
        action: permission.action,
        organizations: {
          some: {
            organizationUnit: {
              users: { some: { id: user.sub } },
            },
          },
        },
      },
    });

    if (!hasPermission) throw new ForbiddenException('Access denied');

    return true;
  }
}
