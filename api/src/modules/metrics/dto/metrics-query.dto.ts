import { IsDateString, IsOptional, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyStatusTrendDto {
  @IsOptional()
  @IsString()
  @Length(7, 7) // YYYY-MM format
  month?: string;
}

export class DailyStatusBreakdownDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

// Base interface for status counts
export interface StatusCounts {
  SUBMITTED: number;
  APPROVED: number;
  REJECTED: number;
  INVOICED: number;
}

export interface DayStatusData extends StatusCounts {
  date: string;
}

export interface StatusBreakdown extends StatusCounts {
  date: string;
}

export interface MonthlyTrendResponse {
  month: string;
  days: DayStatusData[];
}

export interface DailyBreakdownResponse extends StatusBreakdown {}
