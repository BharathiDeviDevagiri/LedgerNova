import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const records = await prisma.idempotencyKey.findMany({
    where: {
      key: {
        in: [
          'concurrent-withdrawal-001',
          'concurrent-withdrawal-002'
        ]
      }
    },
    select: {
      key: true,
      status: true,
      responseStatus: true,
      responseBody: true,
      requestPath: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(JSON.stringify(records, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
