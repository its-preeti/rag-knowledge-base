import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageType: string;
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.storageType = config.get('STORAGE_TYPE', 'local');
    this.uploadDir = config.get('UPLOAD_DIR', './uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    const subdirs = ['documents', 'temp', 'exports'];
    subdirs.forEach((dir) => {
      const fullPath = path.join(this.uploadDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async saveFile(
    buffer: Buffer,
    originalName: string,
    category: string = 'documents',
  ): Promise<{ path: string; url: string; size: number }> {
    const ext = path.extname(originalName);
    const fileName = `${uuidv4()}${ext}`;
    const relativePath = path.join(category, fileName);
    const fullPath = path.join(this.uploadDir, relativePath);

    fs.writeFileSync(fullPath, buffer);

    const url = `/uploads/${relativePath.replace(/\\/g, '/')}`;

    return {
      path: fullPath,
      url,
      size: buffer.length,
    };
  }

  async readFile(filePath: string): Promise<Buffer> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted file: ${filePath}`);
    }
  }

  async getFileStats(filePath: string) {
    const stats = fs.statSync(filePath);
    return { size: stats.size, createdAt: stats.birthtime, modifiedAt: stats.mtime };
  }

  getMimeType(filename: string): string {
    return mime.lookup(filename) || 'application/octet-stream';
  }

  async getTotalStorageUsed(userId: string): Promise<number> {
    // In production, query from DB
    return 0;
  }
}
