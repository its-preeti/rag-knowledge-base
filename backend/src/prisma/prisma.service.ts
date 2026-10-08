import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          // Neon serverless: keep pool small, add connect_timeout to handle cold starts
          url: process.env.DATABASE_URL,
        },
      },
      log: [
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    // Auto-retry middleware for Neon "connection closed" errors
    this.$use(async (params, next) => {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await next(params);
        } catch (error: any) {
          const isConnectionError =
            error?.message?.includes('closed') ||
            error?.message?.includes('Connection') ||
            error?.code === 'P1017' ||
            error?.code === 'P1001';

          if (isConnectionError && attempt < maxRetries) {
            this.logger.warn(`DB connection error (attempt ${attempt}/${maxRetries}), reconnecting...`);
            await this.$disconnect();
            await new Promise((r) => setTimeout(r, 500 * attempt));
            await this.$connect();
          } else {
            throw error;
          }
        }
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
        } catch (error) {
          this.logger.error(`Error truncating ${tablename}:`, error);
        }
      }
    }
  }
}

