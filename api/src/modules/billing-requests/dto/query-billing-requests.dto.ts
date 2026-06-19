import { BillingRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class QueryBillingRequestsDto {
  @ApiPropertyOptional({
    description: 'Filter by billing request status',
    enum: BillingRequestStatus,
    example: 'SUBMITTED'
  })
  @IsOptional()
  @IsEnum(BillingRequestStatus)
  status?: BillingRequestStatus;

  /** When true, restrict results to the caller's own requests. */
  @ApiPropertyOptional({
    description: 'When true, restrict results to the caller\'s own requests',
    example: false
  })
  @IsOptional()
  @Type(() => Boolean)
  mine?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
