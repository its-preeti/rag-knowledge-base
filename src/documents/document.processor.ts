import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DocumentsService } from './documents.service';

@Processor('document-processing')
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Process('process-document')
  async processDocument(job: Job<{ documentId: string }>) {
    const { documentId } = job.data;
    this.logger.log(`Processing document: ${documentId} (attempt ${job.attemptsMade + 1})`);
    try {
      await this.documentsService.processDocument(documentId);
      this.logger.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      this.logger.error(`Document ${documentId} processing failed: ${error.message}`);
      throw error;
    }
  }
}
