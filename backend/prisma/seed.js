import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_ACCOUNT_NUMBER = 'SYS-BANK-CASH-INR';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed is disabled in production.');
  }

  const seedPasswords = {
    holder: process.env.LEDGERLINE_SEED_HOLDER_PASSWORD,
    admin: process.env.LEDGERLINE_SEED_ADMIN_PASSWORD,
    auditor: process.env.LEDGERLINE_SEED_AUDITOR_PASSWORD,
  };

  for (const [role, password] of Object.entries(seedPasswords)) {
    if (!password || password.length < 12) {
      throw new Error(
        `Set LEDGERLINE_SEED_${role.toUpperCase()}_PASSWORD to a unique password of at least 12 characters.`
      );
    }
  }

  console.log('--- Seeding LedgerLine Initial Database ---');

  // 1. Ensure System Bank Cash Account exists
  let cashAccount = await prisma.account.findUnique({
    where: { accountNumber: SYSTEM_ACCOUNT_NUMBER },
  });

  if (!cashAccount) {
    cashAccount = await prisma.account.create({
      data: {
        accountNumber: SYSTEM_ACCOUNT_NUMBER,
        name: 'LedgerLine Central Reserve Cash',
        type: 'ASSET',
        status: 'ACTIVE',
        currency: 'INR',
        balance: 0n,
      },
    });
    console.log('[Seed] Created System Cash Account:', cashAccount.accountNumber);
  } else {
    console.log('[Seed] System Cash Account exists:', cashAccount.accountNumber);
  }

  // 2. Ensure Seed Users exist
  const hashedPassword = await bcrypt.hash(seedPasswords.holder, 12);
  const hashedAdminPassword = await bcrypt.hash(seedPasswords.admin, 12);
  const hashedAuditorPassword = await bcrypt.hash(seedPasswords.auditor, 12);

  // Admin User
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@ledgerline.internal' },
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@ledgerline.internal',
        fullName: 'System Administrator',
        passwordHash: hashedAdminPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('[Seed] Created Admin User: admin@ledgerline.internal');
  }

  // Auditor User
  let auditorUser = await prisma.user.findUnique({
    where: { email: 'auditor@ledgerline.internal' },
  });
  if (!auditorUser) {
    auditorUser = await prisma.user.create({
      data: {
        email: 'auditor@ledgerline.internal',
        fullName: 'Compliance Auditor',
        passwordHash: hashedAuditorPassword,
        role: 'AUDITOR',
        isActive: true,
      },
    });
    console.log('[Seed] Created Auditor User: auditor@ledgerline.internal');
  }

  // Demo Account Holder
  let demoUser = await prisma.user.findUnique({
    where: { email: 'demouser@ledgerline.internal' },
  });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: 'demouser@ledgerline.internal',
        fullName: 'Snovasys Candidate',
        passwordHash: hashedPassword,
        role: 'ACCOUNT_HOLDER',
        isActive: true,
      },
    });
    console.log('[Seed] Created Demo User: demouser@ledgerline.internal');
  }

  // 3. Ensure Demo User has 2 customer accounts
  let checkingAccount = await prisma.account.findFirst({
    where: {
      name: 'Primary Checking Account',
      permissions: { some: { userId: demoUser.id } },
    },
  });

  if (!checkingAccount) {
    checkingAccount = await prisma.account.create({
      data: {
        accountNumber: 'LL-CHK-1001',
        name: 'Primary Checking Account',
        type: 'LIABILITY',
        status: 'ACTIVE',
        currency: 'INR',
        balance: 0n,
      },
    });

    await prisma.accountPermission.create({
      data: {
        userId: demoUser.id,
        accountId: checkingAccount.id,
        permission: 'OWNER',
      },
    });
    console.log('[Seed] Created Checking Account for demo user: LL-CHK-1001');
  }

  let savingsAccount = await prisma.account.findFirst({
    where: {
      name: 'Vault Savings Account',
      permissions: { some: { userId: demoUser.id } },
    },
  });

  if (!savingsAccount) {
    savingsAccount = await prisma.account.create({
      data: {
        accountNumber: 'LL-SAV-2002',
        name: 'Vault Savings Account',
        type: 'LIABILITY',
        status: 'ACTIVE',
        currency: 'INR',
        balance: 0n,
      },
    });

    await prisma.accountPermission.create({
      data: {
        userId: demoUser.id,
        accountId: savingsAccount.id,
        permission: 'OWNER',
      },
    });
    console.log('[Seed] Created Savings Account for demo user: LL-SAV-2002');
  }

  // 4. Fund demo accounts if balances are zero (using double-entry transactions)
  if (checkingAccount.balance === 0n) {
    const depositAmount = 5000000n; // ₹50,000 in paise

    await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          referenceNumber: `LL-SEED-${crypto.randomUUID().slice(0, 8)}`,
          description: 'Initial Account Funding Deposit',
          status: 'POSTED',
          totalAmount: depositAmount,
          actorId: adminUser.id,
          postedAt: new Date(),
        },
      });

      // Debit Cash (Asset increases)
      await tx.ledgerEntry.create({
        data: {
          transactionId: txn.id,
          accountId: cashAccount.id,
          type: 'DEBIT',
          amount: depositAmount,
          runningBalance: cashAccount.balance + depositAmount,
        },
      });

      // Credit Checking (Liability increases)
      await tx.ledgerEntry.create({
        data: {
          transactionId: txn.id,
          accountId: checkingAccount.id,
          type: 'CREDIT',
          amount: depositAmount,
          runningBalance: depositAmount,
        },
      });

      await tx.account.update({
        where: { id: cashAccount.id },
        data: { balance: cashAccount.balance + depositAmount, version: { increment: 1 } },
      });

      await tx.account.update({
        where: { id: checkingAccount.id },
        data: { balance: depositAmount, version: { increment: 1 } },
      });
    });

    console.log('[Seed] Funded Checking Account with ₹50,000.00 (double-entry balanced)');
  }

  console.log('--- Seed Completed Successfully ---');
  console.log('Seed users are ready. Passwords were read from environment variables and were not printed.');
}

main()
  .catch((error) => {
    console.error('[LedgerLine Seed Error]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
