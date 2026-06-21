import { IsString, Length, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendChatMessageDto {
  @ApiProperty({
    description: 'Chat message content',
    example: 'PI reviewed successfully, ready for processing.',
    minLength: 1,
    maxLength: 2000
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000, { message: 'message must be between 1 and 2000 characters' })
  message!: string;
}
