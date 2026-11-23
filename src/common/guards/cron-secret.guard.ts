import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Protects endpoints that a scheduler (for example Vercel Cron) calls without
 * a user session. The scheduler must send `Authorization: Bearer <CRON_SECRET>`.
 * When CRON_SECRET is not configured every request is rejected.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) return false;

    const expected = Buffer.from(secret);
    const received = Buffer.from(token);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }
}
