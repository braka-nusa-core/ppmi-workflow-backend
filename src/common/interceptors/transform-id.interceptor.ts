import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function isPlainObject(data: unknown): data is Record<string, unknown> {
  return (
    data !== null &&
    typeof data === 'object' &&
    Object.getPrototypeOf(data) === Object.prototype
  );
}

function transformIdKey(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(transformIdKey);
  }

  if (isPlainObject(data)) {
    const entries = Object.entries(data).map(([key, value]) => {
      const newKey = key === 'id' ? '_id' : key;
      return [newKey, transformIdKey(value)];
    });
    return Object.fromEntries(entries);
  }

  return data;
}

@Injectable()
export class TransformIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(transformIdKey));
  }
}
