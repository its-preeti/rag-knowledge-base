import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, UseInterceptors, UploadedFile, UploadedFiles,
  BadRequestException, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { memoryStorage } from 'multer';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a single document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 52428800 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('workspaceId') workspaceId: string,
    @Body('name') name: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.documentsService.uploadDocument(file, req.user.id, workspaceId, name);
  }

  @Post('upload/multiple')
  @ApiOperation({ summary: 'Upload multiple documents' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage(), limits: { fileSize: 52428800 } }))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    if (!files?.length) throw new BadRequestException('No files provided');
    const results = await Promise.allSettled(
      files.map((file) => this.documentsService.uploadDocument(file, req.user.id, workspaceId)),
    );
    return {
      succeeded: results.filter((r) => r.status === 'fulfilled').map((r: any) => r.value),
      failed: results.filter((r) => r.status === 'rejected').map((r: any) => r.reason?.message),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents' })
  async findAll(
    @Req() req: any,
    @Query('workspaceId') workspaceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('fileType') fileType?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.documentsService.findAll(req.user.id, workspaceId, {
      page, limit, search, fileType, status, sortBy, sortOrder,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.findById(id, req.user.id);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename document' })
  async rename(@Param('id') id: string, @Req() req: any, @Body('name') name: string) {
    return this.documentsService.rename(id, req.user.id, name);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed document processing' })
  async retry(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.retryProcessing(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.delete(id, req.user.id);
  }
}
