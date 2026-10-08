import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [userCount, docCount, chatCount, usageTotals, recentUsers, recentDocs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.document.count(),
      this.prisma.chat.count(),
      this.prisma.usageLog.aggregate({ _sum: { cost: true, tokensUsed: true } }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      }),
      this.prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const docsByStatus = await this.prisma.document.groupBy({
      by: ['status'],
      _count: true,
    });

    const storageTotal = await this.prisma.document.aggregate({ _sum: { size: true } });

    return {
      users: { total: userCount },
      documents: {
        total: docCount,
        byStatus: Object.fromEntries(docsByStatus.map((s) => [s.status, s._count])),
      },
      chats: { total: chatCount },
      storage: { totalBytes: Number(storageTotal._sum.size || 0) },
      usage: {
        totalTokens: usageTotals._sum.tokensUsed || 0,
        totalCost: usageTotals._sum.cost || 0,
      },
      recentUsers,
      recentDocuments: recentDocs.map((d) => ({ ...d, size: Number(d.size) })),
    };
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
          _count: { select: { documents: true, chats: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.usageLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.usageLog.count(),
    ]);
    return { data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getAnalytics(days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const [dailyUsage, docsByType, topUsers] = await Promise.all([
      this.prisma.usageLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: from } },
        _count: true,
        _sum: { tokensUsed: true, cost: true },
      }),
      this.prisma.document.groupBy({
        by: ['fileType'],
        _count: true,
      }),
      this.prisma.usageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: from } },
        _sum: { tokensUsed: true, cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 10,
      }),
    ]);

    return { dailyUsage, documentsByType: docsByType, topUsers };
  }
}
