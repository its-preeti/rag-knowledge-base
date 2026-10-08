import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { TextProcessorService } from './text-processor.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as path from 'path';
import * as unzipper from 'unzipper';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'application/zip',
];

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly embeddings: EmbeddingsService,
    private readonly textProcessor: TextProcessorService,
    private readonly config: ConfigService,
    @InjectQueue('document-processing') private documentQueue: Queue,
  ) { }

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    workspaceId: string,
    name?: string,
  ) {
    const maxSize = this.config.get('MAX_FILE_SIZE', 52428800);
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    // Simplify the membership check to prevent nested query parse bugs in cloud database pools
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    
    if (!membership) {
      const isOwner = await this.prisma.workspace.findFirst({
        where: { id: workspaceId, ownerId: userId },
      });
      if (!isOwner) {
        throw new ForbiddenException('Workspace not found or access denied');
      }
    }

    // Handle ZIP files
    if (file.mimetype === 'application/zip') {
      return this.handleZipUpload(file, userId, workspaceId);
    }

    const saved = await this.storage.saveFile(file.buffer, file.originalname, 'documents');

    const document = await this.prisma.document.create({
      data: {
        name: name || path.parse(file.originalname).name,
        originalName: file.originalname,
        fileType: path.extname(file.originalname).slice(1).toLowerCase(),
        mimeType: file.mimetype,
        size: BigInt(file.size),
        path: saved.path,
        url: saved.url,
        userId,
        workspaceId,
        status: 'PENDING',
      },
    });

    await this.documentQueue.add('process-document', { documentId: document.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    // In production, execute processing directly in the background to handle Render sleep issues
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
      this.logger.log(`Directly triggering document processing in background: ${document.id}`);
      this.processDocument(document.id).catch((err) => {
        this.logger.error(`Background document processing failed: ${err.message}`);
      });
    }

    return { ...document, size: Number(document.size) };
  }

  private async handleZipUpload(file: Express.Multer.File, userId: string, workspaceId: string) {
    const tempPath = path.join(this.config.get('UPLOAD_DIR', './uploads'), 'temp', `${uuidv4()}.zip`);
    fs.writeFileSync(tempPath, file.buffer);

    const documents: any[] = [];
    const directory = await unzipper.Open.file(tempPath);

    for (const entry of directory.files) {
      if (entry.type === 'File') {
        const ext = path.extname(entry.path).toLowerCase();
        const supportedExts = ['.pdf', '.docx', '.txt', '.csv', '.json', '.md', '.jpg', '.png', '.jpeg', '.webp'];
        if (!supportedExts.includes(ext)) continue;

        const buffer = await entry.buffer();
        const mimeType = this.storage.getMimeType(entry.path);
        const saved = await this.storage.saveFile(buffer, entry.path, 'documents');

        const document = await this.prisma.document.create({
          data: {
            name: path.parse(entry.path).name,
            originalName: path.basename(entry.path),
            fileType: ext.slice(1),
            mimeType,
            size: BigInt(buffer.length),
            path: saved.path,
            url: saved.url,
            userId,
            workspaceId,
            status: 'PENDING',
          },
        });

        await this.documentQueue.add('process-document', { documentId: document.id });
        
        if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
          this.processDocument(document.id).catch((err) => {
            this.logger.error(`Background zip-file processing failed: ${err.message}`);
          });
        }
        
        documents.push({ ...document, size: Number(document.size) });
      }
    }

    fs.unlinkSync(tempPath);
    return { message: `Extracted and queued ${documents.length} files`, documents };
  }

  async processDocument(documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    try {
      const extracted = await this.textProcessor.extractText(
        document.path,
        document.mimeType,
        document.originalName,
      );

      // Generate embeddings for all chunks
      const chunkTexts = extracted.chunks.map((c) => c.content);
      const chunkEmbeddings = chunkTexts.length > 0
        ? await this.embeddings.generateEmbeddings(chunkTexts)
        : [];

      // Store chunks in DB
      if (extracted.chunks.length > 0) {
        await this.prisma.documentChunk.createMany({
          data: extracted.chunks.map((chunk, i) => ({
            documentId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
            embedding: chunkEmbeddings[i] || [],
          })),
        });

        // Upsert to Qdrant
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: document.workspaceId },
        });

        await this.embeddings.upsertDocumentChunks(
          documentId,
          extracted.chunks.map((chunk, i) => ({
            ...chunk,
            embedding: chunkEmbeddings[i] || [],
          })),
          {
            workspaceId: document.workspaceId,
            userId: document.userId,
            documentName: document.name,
            fileType: document.fileType,
            workspaceName: workspace?.name,
          },
        );
      }

      // Generate AI summary, tags, keywords
      const aiMetadata = await this.generateAiMetadata(extracted.text, document.name);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          pageCount: extracted.pageCount,
          wordCount: extracted.wordCount,
          language: extracted.language,
          summary: aiMetadata.summary,
          tags: aiMetadata.tags,
          keywords: aiMetadata.keywords,
          chunkCount: extracted.chunks.length,
          embeddingModel: this.config.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large'),
          processedAt: new Date(),
          metadata: extracted.metadata,
        },
      });

      this.logger.log(`Document ${documentId} processed successfully with ${extracted.chunks.length} chunks`);
    } catch (error) {
      this.logger.error(`Document ${documentId} processing failed: ${error.message}`);
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', processingError: error.message },
      });
      throw error;
    }
  }

  private async generateAiMetadata(text: string, documentName: string) {
    if (!text || text.length < 50) {
      return { summary: null, tags: [], keywords: [] };
    }

    try {
      const OpenAI = require('openai').default;
      const openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY') });

      const sample = text.substring(0, 3000);
      const response = await openai.chat.completions.create({
        model: this.config.get('OPENAI_MODEL', 'gpt-4o'),
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analyze this document and provide a JSON response with:
- summary: 2-3 sentence summary
- tags: array of 3-5 category tags
- keywords: array of 5-10 key terms

Document name: ${documentName}
Content: ${sample}

Respond ONLY with valid JSON, no markdown.`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
      return {
        summary: parsed.summary || null,
        tags: parsed.tags || [],
        keywords: parsed.keywords || [],
      };
    } catch (error) {
      this.logger.warn(`AI metadata generation failed: ${error.message}`);
      return { summary: null, tags: [], keywords: [] };
    }
  }

  async findAll(
    userId: string,
    workspaceId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      fileType?: string;
      status?: string;
      tags?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    const pageNum = isNaN(Number(options?.page)) || Number(options?.page) < 1 ? 1 : Number(options.page);
    const limitNum = isNaN(Number(options?.limit)) || Number(options?.limit) < 1 ? 20 : Number(options.limit);
    const skip = (pageNum - 1) * limitNum;

    // Verify workspace membership first to prevent unauthorized access
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!membership) {
      const isOwner = await this.prisma.workspace.findFirst({
        where: { id: workspaceId, ownerId: userId },
      });
      if (!isOwner) {
        throw new ForbiddenException('Access denied to this workspace');
      }
    }

    const where: any = { workspaceId };
    const { search, fileType, status, tags, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
        { keywords: { has: search } },
      ];
    }
    if (fileType) where.fileType = fileType;
    if (status) where.status = status;
    if (tags?.length) where.tags = { hasSome: tags };

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, name: true, originalName: true, fileType: true, mimeType: true,
          size: true, status: true, pageCount: true, wordCount: true, language: true,
          summary: true, tags: true, keywords: true, chunkCount: true, url: true,
          createdAt: true, updatedAt: true, processedAt: true, processingError: true,
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: documents.map((d) => ({ ...d, size: Number(d.size) })),
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async findById(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, userId },
      include: { _count: { select: { chunks: true } } },
    });
    if (!document) throw new NotFoundException('Document not found');
    return { ...document, size: Number(document.size) };
  }

  async rename(id: string, userId: string, name: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.document.update({ where: { id }, data: { name } });
  }

  async delete(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!document) throw new NotFoundException('Document not found');

    // Delete from Qdrant
    await this.embeddings.deleteDocumentVectors(id);

    // Delete chunks
    await this.prisma.documentChunk.deleteMany({ where: { documentId: id } });

    // Delete file from storage
    await this.storage.deleteFile(document.path);

    // Delete from DB
    await this.prisma.document.delete({ where: { id } });

    return { message: 'Document deleted successfully' };
  }

  async retryProcessing(id: string, userId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== 'FAILED') throw new BadRequestException('Document is not in FAILED status');

    await this.prisma.document.update({
      where: { id },
      data: { status: 'PENDING', processingError: null },
    });

    await this.documentQueue.add('process-document', { documentId: id });
    return { message: 'Document queued for reprocessing' };
  }
}
