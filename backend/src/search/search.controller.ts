import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search documents' })
  async search(
    @Req() req: any,
    @Query('q') query: string,
    @Query('workspaceId') workspaceId: string,
    @Query('mode') mode?: 'semantic' | 'keyword' | 'hybrid',
    @Query('fileTypes') fileTypes?: string,
    @Query('tags') tags?: string,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.search(query, req.user.id, workspaceId, {
      mode,
      fileTypes: fileTypes ? fileTypes.split(',') : undefined,
      tags: tags ? tags.split(',') : undefined,
      limit,
    });
  }

  @Get('global')
  @ApiOperation({ summary: 'Search across all workspaces' })
  async globalSearch(@Req() req: any, @Query('q') query: string) {
    return this.searchService.globalSearch(query, req.user.id);
  }
}
