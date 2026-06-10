import { IsString, Length } from 'class-validator';

export class RejectBillingRequestDto {
  /** A reason is mandatory so the requester knows what to fix. */
  @IsString()
  @Length(3, 500)
  reason!: string;
}
