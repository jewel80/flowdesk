import { BillingRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryBillingRequestsDto {
  @IsOptional()
  @IsEnum(BillingRequestStatus)
  status?: BillingRequestStatus;

  /** When true, restrict results to the caller's own requests. */
  @IsOptional()
  @Type(() => Boolean)
  mine?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
