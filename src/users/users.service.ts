import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: string;
  }) {
    return this.prisma.user.create({ data: data as any });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as any } },
            { lastName: { contains: search, mode: 'insensitive' as any } },
            { email: { contains: search, mode: 'insensitive' as any } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { documents: true, chats: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string; avatar?: string },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, avatar: true, isActive: true, createdAt: true,
      },
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new Error('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });
    return { message: 'Password updated successfully' };
  }

  async updateUser(id: string, data: Partial<{ isActive: boolean; role: string }>) {
    return this.prisma.user.update({
      where: { id },
      data: data as any,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true,
      },
    });
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async getStats(userId: string) {
    const [docCount, chatCount, usageTotal] = await Promise.all([
      this.prisma.document.count({ where: { userId } }),
      this.prisma.chat.count({ where: { userId } }),
      this.prisma.usageLog.aggregate({
        where: { userId },
        _sum: { cost: true, tokensUsed: true },
      }),
    ]);

    const storageDocs = await this.prisma.document.findMany({
      where: { userId },
      select: { size: true },
    });
    const storageUsed = storageDocs.reduce((acc, d) => acc + Number(d.size), 0);

    return {
      documentCount: docCount,
      chatCount,
      storageUsed,
      totalTokens: usageTotal._sum.tokensUsed || 0,
      totalCost: usageTotal._sum.cost || 0,
    };
  }
}
