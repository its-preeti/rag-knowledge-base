import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async search(
    query: string,
    userId: string,
    workspaceId: string,
    options: {
      mode?: 'semantic' | 'keyword' | 'hybrid';
      fileTypes?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      tags?: string[];
      limit?: number;
    } = {},
  ) {
    const { mode = 'hybrid', fileTypes, dateFrom, dateTo, tags, limit = 10 } = options;

    const results: any[] = [];

    if (mode === 'semantic' || mode === 'hybrid') {
      const semanticResults = await this.embeddings.searchSimilar(query, workspaceId, {
        limit: mode === 'hybrid' ? Math.ceil(limit * 0.7) : limit,
        scoreThreshold: 0.25,
        documentIds: fileTypes ? await this.getDocumentIdsByType(userId, workspaceId, fileTypes) : undefined,
      });

      results.push(...semanticResults.map((r) => ({ ...r, searchType: 'semantic' })));
    }

    if (mode === 'keyword' || mode === 'hybrid') {
      const keywordResults = await this.keywordSearch(query, userId, workspaceId, {
        fileTypes, dateFrom, dateTo, tags,
        limit: mode === 'hybrid' ? Math.ceil(limit * 0.5) : limit,
      });
      results.push(...keywordResults.map((r) => ({ ...r, searchType: 'keyword' })));
    }

    // Deduplicate and rank
    const seen = new Set<string>();
    const deduped = results.filter((r) => {
      const key = `${r.documentId}_${r.chunkIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by score descending
    deduped.sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
      results: deduped.slice(0, limit),
      total: deduped.length,
      query,
      mode,
    };
  }

  private async keywordSearch(
    query: string,
    userId: string,
    workspaceId: string,
    options: { fileTypes?: string[]; dateFrom?: Date; dateTo?: Date; tags?: string[]; limit?: number },
  ) {
    const { fileTypes, dateFrom, dateTo, tags, limit = 10 } = options;
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (terms.length === 0) return [];

    const where: any = {
      document: {
        userId,
        workspaceId,
        status: 'COMPLETED',
      },
    };

    if (fileTypes?.length) where.document.fileType = { in: fileTypes };
    if (dateFrom || dateTo) {
      where.document.createdAt = {};
      if (dateFrom) where.document.createdAt.gte = dateFrom;
      if (dateTo) where.document.createdAt.lte = dateTo;
    }
    if (tags?.length) where.document.tags = { hasSome: tags };

    // Search in chunks
    where.OR = terms.map((term) => ({
      content: { contains: term, mode: 'insensitive' },
    }));

    const chunks = await this.prisma.documentChunk.findMany({
      where,
      take: limit,
      include: { document: { select: { name: true, fileType: true } } },
    });

    return chunks.map((chunk) => ({
      id: `${chunk.documentId}_${chunk.chunkIndex}`,
      score: this.calculateKeywordScore(chunk.content, terms),
      content: chunk.content,
      documentId: chunk.documentId,
      documentName: chunk.document.name,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
    }));
  }

  private calculateKeywordScore(content: string, terms: string[]): number {
    const lower = content.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const count = (lower.match(new RegExp(term, 'g')) || []).length;
      score += count * (1 / terms.length);
    }
    return Math.min(score / 10, 1);
  }

  private async getDocumentIdsByType(userId: string, workspaceId: string, fileTypes: string[]) {
    const docs = await this.prisma.document.findMany({
      where: { userId, workspaceId, fileType: { in: fileTypes } },
      select: { id: true },
    });
    return docs.map((d) => d.id);
  }

  async globalSearch(query: string, userId: string) {
    // Search across all user workspaces
    const workspaces = await this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      select: { id: true },
    });

    const allResults: any[] = [];
    for (const workspace of workspaces) {
      const results = await this.search(query, userId, workspace.id, { limit: 5 });
      allResults.push(...results.results);
    }

    allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    return { results: allResults.slice(0, 20), query };
  }
}
