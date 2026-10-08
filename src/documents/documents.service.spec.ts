import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { TextProcessorService } from './text-processor.service';
import { ConfigService } from '@nestjs/config';

const mockDocument = {
  id: 'doc-1',
  name: 'Test Document',
  originalName: 'test.pdf',
  fileType: 'pdf',
  mimeType: 'application/pdf',
  size: BigInt(1024),
  path: '/uploads/documents/test.pdf',
  url: '/uploads/documents/test.pdf',
  status: 'COMPLETED',
  userId: 'user-1',
  workspaceId: 'ws-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaService: any;
  let storageService: any;
  let embeddingsService: any;
  let queue: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              create: jest.fn().mockResolvedValue(mockDocument),
              findMany: jest.fn().mockResolvedValue([mockDocument]),
              findFirst: jest.fn().mockResolvedValue(mockDocument),
              findUnique: jest.fn().mockResolvedValue(mockDocument),
              update: jest.fn().mockResolvedValue(mockDocument),
              delete: jest.fn().mockResolvedValue(mockDocument),
              count: jest.fn().mockResolvedValue(1),
            },
            workspace: {
              findFirst: jest.fn().mockResolvedValue({ id: 'ws-1', name: 'Test WS' }),
              findUnique: jest.fn().mockResolvedValue({ id: 'ws-1', name: 'Test WS' }),
            },
            documentChunk: {
              createMany: jest.fn().mockResolvedValue({ count: 5 }),
              deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            saveFile: jest.fn().mockResolvedValue({ path: '/uploads/test.pdf', url: '/uploads/test.pdf', size: 1024 }),
            deleteFile: jest.fn().mockResolvedValue(undefined),
            getMimeType: jest.fn().mockReturnValue('application/pdf'),
          },
        },
        {
          provide: EmbeddingsService,
          useValue: {
            generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
            upsertDocumentChunks: jest.fn().mockResolvedValue(undefined),
            deleteDocumentVectors: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TextProcessorService,
          useValue: {
            extractText: jest.fn().mockResolvedValue({
              text: 'Sample text content',
              pageCount: 1,
              wordCount: 3,
              language: 'en',
              chunks: [{ content: 'Sample text content', chunkIndex: 0, startChar: 0, endChar: 19 }],
              metadata: {},
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                MAX_FILE_SIZE: 52428800,
                OPENAI_API_KEY: 'test-key',
                OPENAI_MODEL: 'gpt-4o',
                OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large',
                UPLOAD_DIR: './uploads',
              };
              return config[key];
            }),
          },
        },
        {
          provide: getQueueToken('document-processing'),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prismaService = module.get(PrismaService);
    storageService = module.get(StorageService);
    embeddingsService = module.get(EmbeddingsService);
    queue = module.get(getQueueToken('document-processing'));
  });

  describe('findById', () => {
    it('should return document when found', async () => {
      prismaService.document.findFirst.mockResolvedValue({
        ...mockDocument,
        _count: { chunks: 5 },
      });
      const result = await service.findById('doc-1', 'user-1');
      expect(result.id).toBe('doc-1');
      expect(result.size).toBe(1024);
    });

    it('should throw NotFoundException when document not found', async () => {
      prismaService.document.findFirst.mockResolvedValue(null);
      await expect(service.findById('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete document and its vectors', async () => {
      await service.delete('doc-1', 'user-1');
      expect(embeddingsService.deleteDocumentVectors).toHaveBeenCalledWith('doc-1');
      expect(storageService.deleteFile).toHaveBeenCalled();
      expect(prismaService.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });

    it('should throw NotFoundException for non-existent document', async () => {
      prismaService.document.findFirst.mockResolvedValue(null);
      await expect(service.delete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryProcessing', () => {
    it('should queue document for retry when status is FAILED', async () => {
      prismaService.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'FAILED' });
      await service.retryProcessing('doc-1', 'user-1');
      expect(queue.add).toHaveBeenCalledWith('process-document', { documentId: 'doc-1' });
    });

    it('should throw BadRequestException if not FAILED status', async () => {
      prismaService.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'COMPLETED' });
      await expect(service.retryProcessing('doc-1', 'user-1')).rejects.toThrow();
    });
  });

  describe('uploadDocument', () => {
    it('should throw ForbiddenException for invalid workspace', async () => {
      prismaService.workspace.findFirst.mockResolvedValue(null);
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
        size: 1024,
      } as Express.Multer.File;

      await expect(
        service.uploadDocument(mockFile, 'user-1', 'invalid-ws'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create document and queue processing', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
        size: 1024,
      } as Express.Multer.File;

      const result = await service.uploadDocument(mockFile, 'user-1', 'ws-1');
      expect(result).toBeDefined();
      expect(queue.add).toHaveBeenCalled();
    });
  });
});
