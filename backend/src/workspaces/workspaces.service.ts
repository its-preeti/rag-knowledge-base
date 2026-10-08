import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async create(userId: string, data: { name: string; description?: string }) {
    const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    return this.prisma.workspace.create({
      data: {
        name: data.name,
        description: data.description,
        slug,
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
    });
  }

  async findAll(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
        },
        _count: { select: { documents: true, chats: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
        },
        _count: { select: { documents: true, chats: true } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found or access denied');
    return workspace;
  }

  async update(id: string, userId: string, data: { name?: string; description?: string; settings?: any }) {
    await this.checkOwner(id, userId);
    return this.prisma.workspace.update({ where: { id }, data });
  }

  async delete(id: string, userId: string) {
    await this.checkOwner(id, userId);
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (workspace?.isDefault) throw new ForbiddenException('Cannot delete default workspace');

    // Cleanup vectors
    await this.embeddings.deleteWorkspaceVectors(id);

    await this.prisma.workspace.delete({ where: { id } });
    return { message: 'Workspace deleted' };
  }

  async addMember(workspaceId: string, userId: string, memberEmail: string, role: string) {
    await this.checkOwner(workspaceId, userId);
    const member = await this.prisma.user.findUnique({ where: { email: memberEmail } });
    if (!member) throw new NotFoundException('User not found');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: member.id } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId: member.id, role },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async removeMember(workspaceId: string, userId: string, memberId: string) {
    await this.checkOwner(workspaceId, userId);
    if (userId === memberId) throw new ForbiddenException('Cannot remove yourself');
    await this.prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: memberId } });
    return { message: 'Member removed' };
  }

  async getStats(workspaceId: string, userId: string) {
    await this.findById(workspaceId, userId);
    const [docCount, chatCount, docStats, chatsCost] = await Promise.all([
      this.prisma.document.count({ where: { workspaceId } }),
      this.prisma.chat.count({ where: { workspaceId } }),
      this.prisma.document.findMany({ where: { workspaceId }, select: { size: true } }),
      this.prisma.chat.findMany({ where: { workspaceId }, select: { totalCost: true } }),
    ]);
    const storageUsed = docStats.reduce((acc, d) => acc + Number(d.size), 0);
    const totalCost = chatsCost.reduce((acc, c) => acc + (c.totalCost || 0), 0);
    return { documentCount: docCount, chatCount, storageUsed, totalCost };
  }

  private async checkOwner(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!member) throw new ForbiddenException('Insufficient permissions');
  }
}
