import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { HttpAdapterHost } from '@nestjs/core';
import { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client';

@Catch()
export class GlobalException implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  private reply(
    ctx: HttpArgumentsHost,
    statusCode: number,
    name: string,
    message: string,
    details?: unknown,
  ) {
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(
      ctx.getResponse(),
      {
        success: false,
        error: { name, message, details },
      },
      statusCode,
    );
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const { INTERNAL_SERVER_ERROR, BAD_REQUEST } = HttpStatus;

    if (exception instanceof HttpException) {
      const { name, message } = exception;
      return this.reply(ctx, exception.getStatus(), name, message);
    }

    if (exception instanceof ZodError) {
      return this.reply(
        ctx,
        BAD_REQUEST,
        exception.name,
        'Validation failed',
        exception.issues.map(({ path, message, code }) => ({
          field:
            code === 'unrecognized_keys'
              ? exception.issues.find((i) => i.code === 'unrecognized_keys')
                  ?.keys
              : path,
          message,
        })),
      );
    }

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return this.reply(
        ctx,
        INTERNAL_SERVER_ERROR,
        exception.name,
        exception.message,
      );
    }

    if (exception instanceof Error) {
      return this.reply(
        ctx,
        INTERNAL_SERVER_ERROR,
        exception.name,
        exception.message,
      );
    }
  }
}
