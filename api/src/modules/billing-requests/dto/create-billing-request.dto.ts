import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBillingRequestDto {
  @ApiProperty({
    description: 'Title of the billing request',
    example: 'Consulting services for Q2',
    minLength: 3,
    maxLength: 120
  })
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiProperty({
    description: 'Name of the customer',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 120
  })
  @IsString()
  @Length(2, 120)
  customerName!: string;

  /** Amount in major currency units (e.g. dollars). Stored internally as cents. */
  @ApiProperty({
    description: 'Amount in major currency units (e.g. dollars). Stored internally as cents.',
    example: 1500.00,
    minimum: 0.01,
    maximum: 100000000
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'amount must be greater than zero' })
  @Max(100_000_000, { message: 'amount exceeds the maximum allowed value' })
  amount!: number;

  @ApiPropertyOptional({
    description: '3-letter ISO currency code',
    example: 'USD',
    pattern: '^[A-Z]{3}$'
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the billing request',
    example: 'Monthly consulting services for project implementation',
    maxLength: 2000
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}
