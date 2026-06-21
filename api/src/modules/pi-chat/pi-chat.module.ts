import { Module } from '@nestjs/common';
import { PIChatController } from './pi-chat.controller';
import { PIChatService } from './pi-chat.service';
import { PIChatRepository } from './pi-chat.repository';

@Module({
  controllers: [PIChatController],
  providers: [PIChatService, PIChatRepository],
  exports: [PIChatService],
})
export class PIChatModule {}
