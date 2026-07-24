import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { SKIP_INTERCEPTOR_KEY } from '../decorators/skip-interceptor.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = Reflect.getMetadata(
      SKIP_INTERCEPTOR_KEY,
      context.getHandler(),
    );
    if (skip) return next.handle();

    const message = Reflect.getMetadata(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => {
        const response: Record<string, unknown> = { success: true };
        if (message) response.message = message;
        response.data = data ?? null;
        return response;
      }),
    );
  }
}
