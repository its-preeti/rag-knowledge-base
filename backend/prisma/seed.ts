import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@example.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });

  // Create default workspace for admin
  const workspace = await prisma.workspace.upsert({
    where: { slug: `admin-default-${admin.id.substring(0, 8)}` },
    update: {},
    create: {
      name: 'Admin Workspace',
      slug: `admin-default-${admin.id.substring(0, 8)}`,
      isDefault: true,
      ownerId: admin.id,
      members: {
        create: { userId: admin.id, role: 'OWNER' },
      },
    },
  });

  // Default settings
  const defaultSettings = [
    { key: 'openai_model', value: 'gpt-4o' },
    { key: 'openai_temperature', value: 0.1 },
    { key: 'openai_max_tokens', value: 4096 },
    { key: 'embedding_model', value: 'text-embedding-3-large' },
    { key: 'max_file_size_mb', value: 50 },
    { key: 'allowed_file_types', value: ['pdf', 'docx', 'txt', 'csv', 'json', 'md', 'jpg', 'png', 'jpeg', 'webp', 'zip'] },
    { key: 'rag_chunk_size', value: 1000 },
    { key: 'rag_chunk_overlap', value: 200 },
    { key: 'rag_top_k', value: 8 },
    { key: 'rag_score_threshold', value: 0.25 },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value as any },
      create: { key: setting.key, value: setting.value as any },
    });
  }

  console.log(`✅ Admin created: ${admin.email}`);
  console.log(`✅ Default workspace: ${workspace.name}`);
  console.log(`✅ System settings configured`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
