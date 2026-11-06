import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgrespassword@localhost:5432/ledgerline_test?schema=public',
    },
  },
});

try {
  await prisma.$connect();

  const result = await prisma.$queryRaw`
    SELECT current_database() AS database_name
  `;

  console.log('Test database connection successful.');
  console.log('Connected database:', result[0].database_name);
} catch (error) {
  console.error('Test database connection failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
