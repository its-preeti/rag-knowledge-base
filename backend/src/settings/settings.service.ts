import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string) {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  async getAll() {
    const settings = await this.prisma.systemSetting.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async set(key: string, value: any) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async setMany(settings: Record<string, any>) {
    const results = await Promise.all(
      Object.entries(settings).map(([key, value]) => this.set(key, value)),
    );
    return results;
  }

  async delete(key: string) {
    return this.prisma.systemSetting.delete({ where: { key } });
  }
}
