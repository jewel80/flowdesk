import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectBillingRequestDto {
  /** A reason is mandatory so the requester knows what to fix. */
  @ApiProperty({
    description: 'Reason for rejection - mandatory so the requester knows what to fix',
    example: 'Incomplete customer information. Please provide full business address.',
    minLength: 3,
    maxLength: 500
  })
  @IsString()
  @Length(3, 500)
  reason!: string;
}
