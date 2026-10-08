import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DocumentsModule } from './documents/documents.module';
import { ChatModule } from './chat/chat.module';
import { SearchModule } from './search/search.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { StorageModule } from './storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60000),
          limit: config.get('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Bull queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get('REDIS_HOST', 'localhost');
        const port = parseInt(config.get('REDIS_PORT', '6379'), 10);
        const password = config.get('REDIS_PASSWORD');
        const isSecure = host.includes('upstash.io') || host.includes('rediss://');
        return {
          redis: {
            host,
            port,
            password: password || undefined,
            ...(isSecure ? { tls: {} } : {}),
          },
        };
      },
    }),

    // Core modules
    PrismaModule,
    StorageModule,
    EmbeddingsModule,
    QueueModule,

    // Feature modules
    AuthModule,
    UsersModule,
    DocumentsModule,
    ChatModule,
    SearchModule,
    WorkspacesModule,
    AdminModule,
    SettingsModule,
  ],
})
export class AppModule {}
