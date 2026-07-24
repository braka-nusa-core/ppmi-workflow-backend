import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    const authMetaData = this.reflector.getAllAndOverride<string[]>(
      'authorized',
      [context.getHandler(), context.getClass()],
    );

    if (!token) {
      if (authMetaData?.includes('SkipAuth')) {
        return true;
      }

      return false;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      request['credentials'] = payload;

      if (authMetaData?.includes('SkipAuth')) {
        return true;
      }

      if (authMetaData?.includes('AdminOnly')) {
        return payload.role === 'SUPERADMIN';
      }

      if (!authMetaData || authMetaData.length === 0) {
        return true;
      }

      const requiredRoles = authMetaData.map((r) => r.toLowerCase());
      const userRole = payload.role?.toLowerCase();
      return requiredRoles.includes(userRole);
    } catch (error) {
      throw new UnauthorizedException();
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
