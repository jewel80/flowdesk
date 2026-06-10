import { PartialType } from '@nestjs/mapped-types';
import { CreateBillingRequestDto } from './create-billing-request.dto';

/** All fields optional; only a DRAFT owned by the creator may be updated. */
export class UpdateBillingRequestDto extends PartialType(
  CreateBillingRequestDto,
) {}
