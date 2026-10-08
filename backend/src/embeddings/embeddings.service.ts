import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v5 as uuidv5 } from 'uuid';

// Namespace for generating deterministic UUIDs per chunk
const CHUNK_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export interface ChunkWithEmbedding {
  content: string;
  embedding: number[];
  chunkIndex: number;
  pageNumber?: number;
  startChar?: number;
  endChar?: number;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  documentId: string;
  documentName: string;
  pageNumber?: number;
  chunkIndex: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private qdrant: QdrantClient;
  private readonly collectionName: string;
  private readonly vectorSize = 384; // all-MiniLM-L6-v2 vector dimension
  private extractor: any;
  private modelLoadingPromise: Promise<void> | null = null; // prevents duplicate loads

  constructor(private readonly config: ConfigService) {
    this.qdrant = new QdrantClient({
      url: config.get('QDRANT_URL', 'http://localhost:6333'),
      apiKey: config.get('QDRANT_API_KEY') || undefined,
    });
    this.collectionName = config.get('QDRANT_COLLECTION_NAME', 'rag_documents');
    // Ensure collection exists in background — does NOT block startup
    this.ensureCollectionExists().catch((e) =>
      this.logger.error('Qdrant collection init error:', e.message),
    );
  }

  /** Lazy-loads the Xenova model only when first needed. */
  private async ensureModelLoaded(): Promise<void> {
    if (this.extractor) return; // already loaded
    if (!this.modelLoadingPromise) {
      this.modelLoadingPromise = (async () => {
        this.logger.log('Loading Xenova embedding model (first use)...');
        const { pipeline } = await (eval('import("@xenova/transformers")') as Promise<typeof import('@xenova/transformers')>);
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        this.logger.log('Xenova model loaded successfully!');
      })();
    }
    await this.modelLoadingPromise;
  }

  private async ensureCollectionExists() {
    try {
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some((c) => c.name === this.collectionName);
      if (!exists) {
        await this.qdrant.createCollection(this.collectionName, {
          vectors: { size: this.vectorSize, distance: 'Cosine' },
          optimizers_config: { default_segment_number: 2 },
          replication_factor: 1,
        });
        this.logger.log(`Created Qdrant collection: ${this.collectionName}`);
      }

      // Ensure required indexes exist for strict mode compatibility
      const indexFields = ['metadata.workspaceId', 'documentId', 'metadata.fileType'];
      for (const field of indexFields) {
        try {
          await this.qdrant.createPayloadIndex(this.collectionName, {
            field_name: field,
            field_schema: 'keyword',
          });
        } catch (idxError) {
          // Ignore if index already exists
          this.logger.debug(`Index for ${field} might already exist: ${idxError.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant collection:', error.message);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.ensureModelLoaded();
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const emb = await this.generateEmbedding(text);
      embeddings.push(emb);
    }
    return embeddings;
  }

  async upsertDocumentChunks(
    documentId: string,
    chunks: ChunkWithEmbedding[],
    documentMetadata: Record<string, any>,
  ) {
    const points = chunks.map((chunk, i) => ({
      // Qdrant Cloud (strict mode) requires UUID or integer IDs — not arbitrary strings
      id: uuidv5(`${documentId}_${chunk.chunkIndex}`, CHUNK_UUID_NAMESPACE),
      vector: chunk.embedding,
      payload: {
        documentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        metadata: { ...documentMetadata, ...chunk.metadata },
      },
    }));

    await this.qdrant.upsert(this.collectionName, {
      wait: true,
      points,
    });

    this.logger.log(`Upserted ${points.length} chunks for document ${documentId}`);
  }

  async searchSimilar(
    query: string,
    workspaceId: string,
    options: {
      limit?: number;
      scoreThreshold?: number;
      documentIds?: string[];
      fileTypes?: string[];
    } = {},
  ): Promise<SearchResult[]> {
    const { limit = 10, scoreThreshold = 0.3, documentIds, fileTypes } = options;

    const queryEmbedding = await this.generateEmbedding(query);

    const filter: any = {
      must: [{ key: 'metadata.workspaceId', match: { value: workspaceId } }],
    };

    if (documentIds?.length) {
      filter.must.push({
        key: 'documentId',
        match: { any: documentIds },
      });
    }

    if (fileTypes?.length) {
      filter.must.push({
        key: 'metadata.fileType',
        match: { any: fileTypes },
      });
    }

    const results = await this.qdrant.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      score_threshold: scoreThreshold,
      filter,
      with_payload: true,
    });

    return results.map((r) => ({
      id: r.id as string,
      score: r.score,
      content: (r.payload as any).content,
      documentId: (r.payload as any).documentId,
      documentName: (r.payload as any).metadata?.documentName || 'Unknown',
      pageNumber: (r.payload as any).pageNumber,
      chunkIndex: (r.payload as any).chunkIndex,
      metadata: (r.payload as any).metadata,
    }));
  }

  async deleteDocumentVectors(documentId: string) {
    await this.qdrant.delete(this.collectionName, {
      wait: true,
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    });
    this.logger.log(`Deleted vectors for document ${documentId}`);
  }

  async deleteWorkspaceVectors(workspaceId: string) {
    await this.qdrant.delete(this.collectionName, {
      wait: true,
      filter: {
        must: [{ key: 'metadata.workspaceId', match: { value: workspaceId } }],
      },
    });
  }

  private chunk<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size),
    );
  }
}
