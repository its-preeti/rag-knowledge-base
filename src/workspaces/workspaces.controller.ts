import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create workspace' })
  async create(@Req() req: any, @Body() body: { name: string; description?: string }) {
    return this.workspacesService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workspaces' })
  async findAll(@Req() req: any) {
    return this.workspacesService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.workspacesService.findById(id, req.user.id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get workspace stats' })
  async getStats(@Param('id') id: string, @Req() req: any) {
    return this.workspacesService.getStats(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace' })
  async update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.workspacesService.update(id, req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workspace' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.workspacesService.delete(id, req.user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to workspace' })
  async addMember(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { email: string; role: string },
  ) {
    return this.workspacesService.addMember(id, req.user.id, body.email, body.role);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove member from workspace' })
  async removeMember(@Param('id') id: string, @Param('memberId') memberId: string, @Req() req: any) {
    return this.workspacesService.removeMember(id, req.user.id, memberId);
  }
}
