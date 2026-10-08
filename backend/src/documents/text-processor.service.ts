import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TextChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  startChar: number;
  endChar: number;
}

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  wordCount: number;
  language: string;
  chunks: TextChunk[];
  metadata: Record<string, any>;
}

@Injectable()
export class TextProcessorService {
  private readonly logger = new Logger(TextProcessorService.name);
  private readonly chunkSize = 1000;
  private readonly chunkOverlap = 200;

  async extractText(filePath: string, mimeType: string, originalName: string): Promise<ExtractedDocument> {
    this.logger.log(`Extracting text from: ${originalName} (${mimeType})`);

    let text = '';
    let pageCount: number | undefined;
    const metadata: Record<string, any> = { originalName, mimeType };

    try {
      if (mimeType === 'application/pdf' || originalName.endsWith('.pdf')) {
        const result = await this.extractPdf(filePath);
        text = result.text;
        pageCount = result.pageCount;
        metadata.pageCount = pageCount;
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        originalName.endsWith('.docx')
      ) {
        text = await this.extractDocx(filePath);
      } else if (mimeType === 'text/plain' || originalName.endsWith('.txt')) {
        text = fs.readFileSync(filePath, 'utf-8');
      } else if (mimeType === 'text/csv' || originalName.endsWith('.csv')) {
        text = await this.extractCsv(filePath);
      } else if (mimeType === 'application/json' || originalName.endsWith('.json')) {
        text = this.extractJson(filePath);
      } else if (
        mimeType === 'text/markdown' ||
        originalName.endsWith('.md') ||
        originalName.endsWith('.markdown')
      ) {
        text = fs.readFileSync(filePath, 'utf-8');
        text = this.stripMarkdown(text);
      } else if (mimeType.startsWith('image/')) {
        text = await this.extractImageOcr(filePath);
        metadata.isOcr = true;
      } else {
        // Try reading as plain text
        try {
          text = fs.readFileSync(filePath, 'utf-8');
        } catch {
          text = '';
        }
      }
    } catch (error) {
      this.logger.error(`Error extracting text: ${error.message}`);
      text = '';
    }

    text = this.cleanText(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const language = this.detectLanguage(text);
    const chunks = this.splitIntoChunks(text, pageCount);

    return { text, pageCount, wordCount, language, chunks, metadata };
  }

  private async extractPdf(filePath: string): Promise<{ text: string; pageCount: number }> {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { text: data.text, pageCount: data.numpages };
    } catch (error) {
      this.logger.warn(`PDF parse failed, trying OCR: ${error.message}`);
      const text = await this.extractImageOcr(filePath);
      return { text, pageCount: 1 };
    }
  }

  private async extractDocx(filePath: string): Promise<string> {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async extractCsv(filePath: string): Promise<string> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length === 0) return '';
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
      return headers.map((h, i) => `${h}: ${values[i] || ''}`).join(', ');
    });
    return `CSV Data with columns: ${headers.join(', ')}\n\n${rows.join('\n')}`;
  }

  private extractJson(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const parsed = JSON.parse(content);
      return this.jsonToText(parsed, '');
    } catch {
      return content;
    }
  }

  private jsonToText(obj: any, indent: string): string {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
      return obj.map((item) => this.jsonToText(item, indent + '  ')).join('\n');
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj)
        .map(([k, v]) => `${indent}${k}: ${this.jsonToText(v, indent + '  ')}`)
        .join('\n');
    }
    return '';
  }

  private async extractImageOcr(filePath: string): Promise<string> {
    try {
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(filePath);
      await worker.terminate();
      return text;
    } catch (error) {
      this.logger.error(`OCR failed: ${error.message}`);
      return '';
    }
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '')
      .replace(/^\s*\d+\.\s/gm, '');
  }

  cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\x20-\x7E\n\u00C0-\u024F\u0400-\u04FF]/g, ' ')
      .trim();
  }

  splitIntoChunks(text: string, pageCount?: number): TextChunk[] {
    if (!text || text.length === 0) return [];

    const chunks: TextChunk[] = [];
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;
    let charPosition = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        const endChar = currentStart + currentChunk.length;
        const pageNumber = pageCount
          ? Math.ceil(((currentStart + endChar) / 2 / text.length) * pageCount)
          : undefined;

        chunks.push({
          content: currentChunk.trim(),
          chunkIndex,
          pageNumber,
          startChar: currentStart,
          endChar,
        });

        chunkIndex++;
        // Overlap: keep last overlap chars
        const overlapText = currentChunk.slice(-this.chunkOverlap);
        currentStart = endChar - overlapText.length;
        currentChunk = overlapText + sentence;
      } else {
        currentChunk += sentence;
      }
      charPosition += sentence.length;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        pageNumber: pageCount,
        startChar: currentStart,
        endChar: currentStart + currentChunk.length,
      });
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    return text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  }

  private detectLanguage(text: string): string {
    // Simple heuristic - in production use franc or similar
    const sample = text.substring(0, 500).toLowerCase();
    const englishWords = ['the', 'is', 'are', 'was', 'were', 'and', 'or', 'but'];
    const matches = englishWords.filter((w) => sample.includes(` ${w} `)).length;
    return matches > 2 ? 'en' : 'unknown';
  }
}
