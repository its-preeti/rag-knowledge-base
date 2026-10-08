import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentProcessor } from './document.processor';
import { TextProcessorService } from './text-processor.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'document-processing' }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentProcessor, TextProcessorService],
  exports: [DocumentsService, TextProcessorService],
})
export class DocumentsModule {}
