import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========== CONCURRENT WITHDRAWAL TRANSACTIONS ==========');

  const transactions = await prisma.transaction.findMany({
    where: {
      description: 'Concurrent withdrawal test'
    },
    include: {
      ledgerEntries: {
        include: {
          account: {
            select: {
              id: true,
              accountNumber: true,
              name: true,
              type: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(JSON.stringify(transactions.map(t => ({
    id: t.id,
    status: t.status,
    amountPaise: t.totalAmount.toString(),
    actorId: t.actorId,
    createdAt: t.createdAt,
    ledgerEntries: t.ledgerEntries.map(e => ({
      account: e.account.name,
      accountType: e.account.type,
      entryType: e.type,
      amountPaise: e.amount.toString(),
      runningBalancePaise: e.runningBalance.toString()
    }))
  })), null, 2));

  console.log('\n========== WITHDRAWAL AUDIT LOGS ==========');

  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['WITHDRAWAL_POSTED', 'WITHDRAWAL_REFUSED']
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log(JSON.stringify(logs.map(log => ({
    action: log.action,
    entityId: log.entityId,
    userId: log.userId,
    newValues: log.newValues,
    createdAt: log.createdAt
  })), null, 2));

  console.log('\n========== CURRENT ACCOUNT BALANCES ==========');

  const accounts = await prisma.account.findMany({
    where: {
      id: {
        in: [
          '4c7d89a9-812a-48e1-8bce-485f039d1fa8',
          '746b1d7d-a17e-4f25-86ab-563d5701ef88',
          '6a02e1f3-5ac8-432a-843b-54562e0dd4a2'
        ]
      }
    }
  });

  console.log(JSON.stringify(accounts.map(a => ({
    name: a.name,
    type: a.type,
    balancePaise: a.balance.toString()
  })), null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
