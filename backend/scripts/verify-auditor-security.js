import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import { formatPaiseToRupees } from '../src/utils/money.js';

const accountIds = [
  '4c7d89a9-812a-48e1-8bce-485f039d1fa8',
  '746b1d7d-a17e-4f25-86ab-563d5701ef88',
];

const testDescription = 'Auditor read-only security test';

try {
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: {
      id: true,
      name: true,
      accountNumber: true,
      balance: true,
    },
  });

  console.log('\nACCOUNT BALANCES');
  console.table(accounts.map((account) => ({
    name: account.name,
    accountNumber: account.accountNumber,
    balanceINR: formatPaiseToRupees(account.balance),
  })));

  const transactions = await prisma.transaction.findMany({
    where: { description: testDescription },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      description: true,
    },
  });

  console.log('\nAUDITOR TEST FINANCIAL TRANSACTIONS');
  console.table(transactions.map((transaction) => ({
    id: transaction.id,
    status: transaction.status,
    amountINR: formatPaiseToRupees(transaction.totalAmount),
    description: transaction.description,
  })));

  console.log('\nTransaction count:', transactions.length);

  if (transactions.length === 0) {
    console.log('PASS: No financial transaction was created by the rejected withdrawal.');
  } else {
    console.log('WARNING: Check the transaction records.');
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
