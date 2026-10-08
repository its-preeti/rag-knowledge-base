import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-processing' }),
    BullModule.registerQueue({ name: 'email' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
