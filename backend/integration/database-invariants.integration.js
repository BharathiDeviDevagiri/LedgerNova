import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import prisma from '../src/config/prisma.js';

let testUser;

function uniqueValue(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

// Always create accounts with zero balance.
// Their balances must be established through ledger entries.
async function createAccount(type) {
  return prisma.account.create({
    data: {
      accountNumber: `T${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
      name: uniqueValue('Invariant Test Account'),
      type,
      balance: 0n,
      currency: 'INR',
    },
  });
}

// Force deferred PostgreSQL constraint triggers to execute now,
// while still inside the transaction being tested.
async function verifyDeferredConstraints(tx) {
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
}

// Creates a valid posted transaction with matching ledger entries
// and account balances, all inside one database transaction.
async function createValidPostedTransaction() {
  const asset = await createAccount('ASSET');
  const liability = await createAccount('LIABILITY');

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        referenceNumber: uniqueValue('VALID'),
        description: 'Valid posted transaction for invariant tests',
        status: 'PENDING',
        totalAmount: 100n,
        actorId: testUser.id,
      },
    });

    await tx.ledgerEntry.createMany({
      data: [
        {
          transactionId: created.id,
          accountId: asset.id,
          type: 'DEBIT',
          amount: 100n,
          runningBalance: 100n,
        },
        {
          transactionId: created.id,
          accountId: liability.id,
          type: 'CREDIT',
          amount: 100n,
          runningBalance: 100n,
        },
      ],
    });

    await tx.account.update({
      where: { id: asset.id },
      data: { balance: 100n },
    });

    await tx.account.update({
      where: { id: liability.id },
      data: { balance: 100n },
    });

    await tx.transaction.update({
      where: { id: created.id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
      },
    });

    await verifyDeferredConstraints(tx);

    return created;
  });

  return { transaction, asset, liability };
}

before(async () => {
  const rows = await prisma.$queryRaw`
    SELECT current_database() AS name
  `;

  assert.equal(
    rows[0].name,
    'ledgerline_test',
    'Database invariant tests must only use ledgerline_test.'
  );

  testUser = await prisma.user.create({
    data: {
      email: `${crypto.randomUUID()}@invariant-test.example`,
      fullName: 'Database Invariant Test User',
      passwordHash: 'not-used-in-tests',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('[Database Invariants] Connected to ledgerline_test.');
});

after(async () => {
  await prisma.$disconnect();
});

test('Database invariant: POSTED transaction requires postedAt', async () => {
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            referenceNumber: uniqueValue('NO-POSTED-AT'),
            description: 'Posted transaction without timestamp',
            status: 'POSTED',
            totalAmount: 100n,
            actorId: testUser.id,
            postedAt: null,
          },
        });

        await verifyDeferredConstraints(tx);
      })
  );
});

test('Database invariant: FAILED transaction cannot have postedAt', async () => {
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            referenceNumber: uniqueValue('FAILED-POSTED-AT'),
            description: 'Failed transaction with timestamp',
            status: 'FAILED',
            totalAmount: 100n,
            actorId: testUser.id,
            postedAt: new Date(),
          },
        });

        await verifyDeferredConstraints(tx);
      })
  );
});

test('Database invariant: PENDING transaction cannot be committed', async () => {
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            referenceNumber: uniqueValue('PENDING'),
            description: 'Pending transaction commit test',
            status: 'PENDING',
            totalAmount: 100n,
            actorId: testUser.id,
          },
        });

        await verifyDeferredConstraints(tx);
      })
  );
});

test('Database invariant: unbalanced double-entry transaction is rejected', async () => {
  const asset = await createAccount('ASSET');
  const liability = await createAccount('LIABILITY');

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            referenceNumber: uniqueValue('UNBALANCED'),
            description: 'Unbalanced transaction test',
            status: 'PENDING',
            totalAmount: 100n,
            actorId: testUser.id,
          },
        });

        await tx.ledgerEntry.createMany({
          data: [
            {
              transactionId: transaction.id,
              accountId: asset.id,
              type: 'DEBIT',
              amount: 100n,
              runningBalance: 100n,
            },
            {
              transactionId: transaction.id,
              accountId: liability.id,
              type: 'CREDIT',
              amount: 90n,
              runningBalance: 90n,
            },
          ],
        });

        // These balances match their individual ledger entries.
        // The transaction itself is still unbalanced: 100 != 90.
        await tx.account.update({
          where: { id: asset.id },
          data: { balance: 100n },
        });

        await tx.account.update({
          where: { id: liability.id },
          data: { balance: 90n },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'POSTED',
            postedAt: new Date(),
          },
        });

        await verifyDeferredConstraints(tx);
      })
  );
});

test('Database invariant: account balance must match its ledger', async () => {
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.account.create({
          data: {
            accountNumber: `T${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
            name: 'Incorrect cached balance test',
            type: 'ASSET',
            balance: 1n,
            currency: 'INR',
          },
        });

        await verifyDeferredConstraints(tx);
      })
  );
});

test('Database invariant: a POSTED transaction cannot be modified', async () => {
  const { transaction } = await createValidPostedTransaction();

  await assert.rejects(() =>
    prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        description: 'Attempted modification',
      },
    })
  );
});

test('Database invariant: ledger entries and audit logs are append-only', async () => {
  const { transaction, asset } = await createValidPostedTransaction();

  const ledgerEntry = await prisma.ledgerEntry.findFirst({
    where: { transactionId: transaction.id },
  });

  assert.ok(ledgerEntry);

  await assert.rejects(() =>
    prisma.ledgerEntry.update({
      where: { id: ledgerEntry.id },
      data: { amount: 200n },
    })
  );

  await assert.rejects(() =>
    prisma.ledgerEntry.delete({
      where: { id: ledgerEntry.id },
    })
  );

  const auditLog = await prisma.auditLog.create({
    data: {
      userId: testUser.id,
      action: 'INVARIANT_TEST',
      entityType: 'ACCOUNT',
      entityId: asset.id,
      newValues: { purpose: 'append-only test' },
    },
  });

  await assert.rejects(() =>
    prisma.auditLog.update({
      where: { id: auditLog.id },
      data: { action: 'MODIFIED' },
    })
  );

  await assert.rejects(() =>
    prisma.auditLog.delete({
      where: { id: auditLog.id },
    })
  );
});