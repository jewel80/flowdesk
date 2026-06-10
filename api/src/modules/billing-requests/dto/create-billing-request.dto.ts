import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateBillingRequestDto {
  @IsString()
  @Length(3, 120)
  title!: string;

  @IsString()
  @Length(2, 120)
  customerName!: string;

  /** Amount in major currency units (e.g. dollars). Stored internally as cents. */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'amount must be greater than zero' })
  @Max(100_000_000, { message: 'amount exceeds the maximum allowed value' })
  amount!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}
