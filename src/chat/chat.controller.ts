import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Res, StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new chat' })
  async create(@Req() req: any, @Body() body: { workspaceId: string; title?: string }) {
    return this.chatService.createChat(req.user.id, body.workspaceId, body.title);
  }

  @Get()
  @ApiOperation({ summary: 'Get all chats' })
  async findAll(
    @Req() req: any,
    @Query('workspaceId') workspaceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.findAllChats(req.user.id, workspaceId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get chat with messages' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.chatService.findChatById(id, req.user.id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message (streaming SSE)' })
  async sendMessage(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
    @Body() body: { content: string; documentIds?: string[] },
  ) {
    return this.chatService.sendMessage(id, req.user.id, body.content, res, body.documentIds);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate last assistant response' })
  async regenerate(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    return this.chatService.regenerateLastResponse(id, req.user.id, res);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename chat' })
  async rename(@Param('id') id: string, @Req() req: any, @Body('title') title: string) {
    return this.chatService.renameChat(id, req.user.id, title);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete chat' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.chatService.deleteChat(id, req.user.id);
  }

  @Get(':id/export/pdf')
  @ApiOperation({ summary: 'Export chat to PDF' })
  async exportPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const buffer = await this.chatService.exportChatToPdf(id, req.user.id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="chat-${id}.pdf"` });
    res.send(buffer);
  }

  @Get(':id/export/markdown')
  @ApiOperation({ summary: 'Export chat to Markdown' })
  async exportMarkdown(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const content = await this.chatService.exportChatToMarkdown(id, req.user.id);
    res.set({ 'Content-Type': 'text/markdown', 'Content-Disposition': `attachment; filename="chat-${id}.md"` });
    res.send(content);
  }
}
