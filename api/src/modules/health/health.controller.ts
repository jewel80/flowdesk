import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

/** Liveness/readiness endpoint used by Docker healthchecks and reviewers. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) { }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Liveness/readiness endpoint used by Docker healthchecks. Returns the health status of the API and database connection.'
  })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
    schema: {
      example: {
        status: 'ok',
        database: 'up',
        timestamp: '2026-06-19T15:30:00.000Z'
      }
    }
  })
  async check() {
    let database = 'down';
    try {
      await this.prisma.primary.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
