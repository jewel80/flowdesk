import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Consistent error envelope for every failure in the API. The frontend can rely
 * on a single shape regardless of whether the error originated in validation,
 * business rules, Prisma, or an unexpected crash.
 *
 *   {
 *     "statusCode": 409,
 *     "error": "Conflict",
 *     "message": "Cannot approve a request that is not SUBMITTED",
 *     "path": "/billing-requests/123/approve",
 *     "timestamp": "2026-06-10T..."
 *   }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.normalise(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalise(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      // ValidationPipe returns an object with a `message` array; surface it as-is.
      const message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message as string | string[]);
      return {
        status,
        error: HttpStatus[status] ?? 'Error',
        message: message ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'A record with this unique value already exists',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'The requested record was not found',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Database request could not be processed',
        };
    }
  }
}
