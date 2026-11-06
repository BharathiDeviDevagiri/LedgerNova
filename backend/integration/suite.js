import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

const TEST_PASSWORD = 'LedgerLine-Test-Only@2026';

let systemCashAccount;

function uniqueValue(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function createUser(role = 'ACCOUNT_HOLDER') {
  const id = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      email: `${id}@ledgerline-test.example`,
      fullName: `Test ${role} ${id.slice(0, 8)}`,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      role,
      isActive: true,
    },
  });

  return user;
}

function tokenFor(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    {
      expiresIn: '1h',
      algorithm: 'HS256',
    }
  );
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createCustomerAccount(user, name = 'Automated Test Account') {
  const account = await prisma.account.create({
    data: {
      accountNumber: `TST${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`,
      name: `${name} ${crypto.randomUUID().slice(0, 8)}`,
      type: 'LIABILITY',
      status: 'ACTIVE',
      currency: 'INR',
      balance: 0n,
    },
  });

  await prisma.accountPermission.create({
    data: {
      userId: user.id,
      accountId: account.id,
      permission: 'OWNER',
    },
  });

  return account;
}

async function ensureSystemCashAccount() {
  return prisma.account.upsert({
    where: {
      accountNumber: 'SYS-BANK-CASH-INR',
    },
    update: {},
    create: {
      accountNumber: 'SYS-BANK-CASH-INR',
      name: 'LedgerLine Test Bank Cash',
      type: 'ASSET',
      status: 'ACTIVE',
      currency: 'INR',
      balance: 0n,
    },
  });
}

async function deposit(token, accountId, amount, key, description) {
  return request(app)
    .post('/api/transactions/deposit')
    .set(auth(token))
    .set('Idempotency-Key', key)
    .send({
      accountId,
      amount,
      description,
    });
}

async function withdraw(token, accountId, amount, key, description) {
  return request(app)
    .post('/api/transactions/withdraw')
    .set(auth(token))
    .set('Idempotency-Key', key)
    .send({
      accountId,
      amount,
      description,
    });
}

async function readAccountBalance(accountId) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  return account.balance;
}

async function assertAccountLedgerMatchesBalance(accountId, accountType) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId },
  });

  let debits = 0n;
  let credits = 0n;

  for (const entry of entries) {
    if (entry.type === 'DEBIT') {
      debits += entry.amount;
    } else {
      credits += entry.amount;
    }
  }

  const calculatedBalance = ['ASSET', 'EXPENSE'].includes(accountType)
    ? debits - credits
    : credits - debits;

  assert.equal(
    account.balance,
    calculatedBalance,
    `Account ${accountId} balance must match its ledger entries.`
  );

  assert.ok(account.balance >= 0n, 'Account balance must never be negative.');
}

async function assertTransactionIsBalanced(transactionId) {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { ledgerEntries: true },
  });

  assert.equal(transaction.status, 'POSTED');

  let debits = 0n;
  let credits = 0n;

  for (const entry of transaction.ledgerEntries) {
    if (entry.type === 'DEBIT') {
      debits += entry.amount;
    } else {
      credits += entry.amount;
    }
  }

  assert.ok(transaction.ledgerEntries.length >= 2);
  assert.equal(debits, credits, 'Transaction debits and credits must balance.');
  assert.equal(debits, transaction.totalAmount);
}

before(async () => {
  const result = await prisma.$queryRaw`
    SELECT current_database() AS database_name
  `;

  assert.equal(
    result[0].database_name,
    'ledgerline_test',
    'Safety check: refusing to run tests against the demo database.'
  );

  systemCashAccount = await ensureSystemCashAccount();

  console.log('[LedgerLine Tests] Connected to ledgerline_test.');
});

after(async () => {
  await prisma.$disconnect();
});

test('Authentication: registration cannot assign the ADMIN role', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      fullName: 'Role Escalation Test',
      email: `${crypto.randomUUID()}@ledgerline-test.example`,
      password: TEST_PASSWORD,
      role: 'ADMIN',
    });

  assert.equal(response.status, 400);

  const users = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  assert.ok(users.length >= 0);
});

test('Authorization: users and auditors can only read assigned accounts', async () => {
  const ownerA = await createUser();
  const ownerB = await createUser();
  const auditor = await createUser('AUDITOR');

  const accountA = await createCustomerAccount(ownerA, 'Owner A Account');
  const accountB = await createCustomerAccount(ownerB, 'Owner B Account');

  await prisma.accountPermission.create({
    data: {
      userId: auditor.id,
      accountId: accountA.id,
      permission: 'VIEWER',
    },
  });

  const ownerAToken = tokenFor(ownerA);
  const ownerBToken = tokenFor(ownerB);
  const auditorToken = tokenFor(auditor);

  const assignedRead = await request(app)
    .get(`/api/accounts/${accountA.id}`)
    .set(auth(auditorToken));

  assert.equal(assignedRead.status, 200);

  const unassignedRead = await request(app)
    .get(`/api/accounts/${accountB.id}`)
    .set(auth(auditorToken));

  assert.equal(unassignedRead.status, 403);

  const ownerRead = await request(app)
    .get(`/api/accounts/${accountA.id}`)
    .set(auth(ownerAToken));

  assert.equal(ownerRead.status, 200);

  const crossUserRead = await request(app)
    .get(`/api/accounts/${accountA.id}`)
    .set(auth(ownerBToken));

  assert.equal(crossUserRead.status, 403);

  const auditorCreate = await request(app)
    .post('/api/accounts')
    .set(auth(auditorToken))
    .send({ name: 'Auditor Must Not Create This' });

  assert.equal(auditorCreate.status, 403);

  const auditorWithdrawal = await request(app)
    .post('/api/transactions/withdraw')
    .set(auth(auditorToken))
    .set('Idempotency-Key', uniqueValue('auditor-withdraw'))
    .send({
      accountId: accountA.id,
      amount: '1.00',
      description: 'Auditor read-only test',
    });

  assert.equal(auditorWithdrawal.status, 403);

  const statementRead = await request(app)
    .get(`/api/accounts/${accountA.id}/statement`)
    .set(auth(auditorToken));

  assert.equal(statementRead.status, 200);

  const statementDenied = await request(app)
    .get(`/api/accounts/${accountB.id}/statement`)
    .set(auth(auditorToken));

  assert.equal(statementDenied.status, 403);

  const assignedTransaction = await deposit(
    ownerAToken,
    accountA.id,
    '10.00',
    uniqueValue('auditor-assigned-transaction'),
    uniqueValue('Auditor assigned transaction')
  );
  const unassignedTransaction = await deposit(
    ownerBToken,
    accountB.id,
    '10.00',
    uniqueValue('auditor-unassigned-transaction'),
    uniqueValue('Auditor unassigned transaction')
  );

  assert.equal(assignedTransaction.status, 201);
  assert.equal(unassignedTransaction.status, 201);

  const assignedDetail = await request(app)
    .get(`/api/transactions/${assignedTransaction.body.transaction.id}`)
    .set(auth(auditorToken));
  const unassignedDetail = await request(app)
    .get(`/api/transactions/${unassignedTransaction.body.transaction.id}`)
    .set(auth(auditorToken));
  const auditorTransactions = await request(app)
    .get('/api/transactions?limit=100')
    .set(auth(auditorToken));

  assert.equal(assignedDetail.status, 200);
  assert.equal(unassignedDetail.status, 403);
  assert.ok(
    auditorTransactions.body.transactions.some(
      (transaction) => transaction.id === assignedTransaction.body.transaction.id
    )
  );
  assert.ok(
    auditorTransactions.body.transactions.every(
      (transaction) => transaction.id !== unassignedTransaction.body.transaction.id
    )
  );
});

test('Idempotency: replaying a deposit does not create another transaction', async () => {
  const user = await createUser();
  const account = await createCustomerAccount(user);
  const token = tokenFor(user);

  const key = uniqueValue('deposit-replay');
  const description = uniqueValue('Idempotency Deposit');

  const first = await deposit(
    token,
    account.id,
    '100.00',
    key,
    description
  );

  assert.equal(first.status, 201);
  assert.equal(first.body.success, true);
  assert.equal(first.body.replayed, false);

  const firstTransactionId = first.body.transaction.id;

  const replay = await deposit(
    token,
    account.id,
    '100.00',
    key,
    description
  );

  assert.equal(replay.status, 201);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.transaction.id, firstTransactionId);

  const changedPayload = await deposit(
    token,
    account.id,
    '200.00',
    key,
    description
  );

  assert.equal(changedPayload.status, 409);

  assert.equal(await readAccountBalance(account.id), 10000n);

  const transactionCount = await prisma.transaction.count({
    where: { description },
  });

  assert.equal(transactionCount, 1);

  await assertTransactionIsBalanced(firstTransactionId);
  await assertAccountLedgerMatchesBalance(account.id, 'LIABILITY');
});

test('Idempotency: concurrent identical deposits post once and replay the response', async () => {
  const user = await createUser();
  const account = await createCustomerAccount(user, 'Concurrent Idempotency Account');
  const token = tokenFor(user);
  const key = uniqueValue('concurrent-idempotency');
  const description = uniqueValue('Concurrent Idempotency Deposit');

  const [first, second] = await Promise.all([
    deposit(token, account.id, '25.00', key, description),
    deposit(token, account.id, '25.00', key, description),
  ]);

  assert.deepEqual([first.status, second.status], [201, 201]);
  assert.equal(
    [first.body.replayed, second.body.replayed].filter(Boolean).length,
    1
  );
  assert.equal(
    first.body.transaction.id,
    second.body.transaction.id
  );
  assert.equal(await readAccountBalance(account.id), 2500n);
  assert.equal(await prisma.transaction.count({ where: { description } }), 1);
});

test('Authorization: a user cannot transfer money from another user account', async () => {
  const ownerA = await createUser();
  const ownerB = await createUser();

  const accountA = await createCustomerAccount(ownerA, 'Sender Account');
  const accountB = await createCustomerAccount(ownerB, 'Receiver Account');

  const ownerAToken = tokenFor(ownerA);
  const ownerBToken = tokenFor(ownerB);

  const funding = await deposit(
    ownerAToken,
    accountA.id,
    '100.00',
    uniqueValue('unauthorized-funding'),
    uniqueValue('Unauthorized Funding')
  );

  assert.equal(funding.status, 201);

  const balanceBeforeA = await readAccountBalance(accountA.id);
  const balanceBeforeB = await readAccountBalance(accountB.id);

  const description = uniqueValue('Unauthorized Transfer');

  const attack = await request(app)
    .post('/api/transactions/transfer')
    .set(auth(ownerBToken))
    .set('Idempotency-Key', uniqueValue('unauthorized-transfer'))
    .send({
      fromAccountId: accountA.id,
      toAccountId: accountB.id,
      amount: '50.00',
      description,
    });

  assert.equal(attack.status, 403);

  assert.equal(await readAccountBalance(accountA.id), balanceBeforeA);
  assert.equal(await readAccountBalance(accountB.id), balanceBeforeB);

  const transactionCount = await prisma.transaction.count({
    where: { description },
  });

  assert.equal(transactionCount, 0);

  await assertAccountLedgerMatchesBalance(accountA.id, 'LIABILITY');
  await assertAccountLedgerMatchesBalance(accountB.id, 'LIABILITY');
});

test('Concurrency: two withdrawals cannot spend the same available balance', async () => {
  const user = await createUser();
  const account = await createCustomerAccount(user, 'Concurrent Withdrawal Account');
  const token = tokenFor(user);

  const funding = await deposit(
    token,
    account.id,
    '1000.00',
    uniqueValue('concurrent-funding'),
    uniqueValue('Concurrent Funding')
  );

  assert.equal(funding.status, 201);

  const description = uniqueValue('Concurrent Withdrawal');

  const [withdrawalA, withdrawalB] = await Promise.all([
    withdraw(
      token,
      account.id,
      '700.00',
      uniqueValue('concurrent-withdrawal-a'),
      description
    ),
    withdraw(
      token,
      account.id,
      '700.00',
      uniqueValue('concurrent-withdrawal-b'),
      description
    ),
  ]);

  const statuses = [withdrawalA.status, withdrawalB.status].sort();

  assert.deepEqual(
    statuses,
    [201, 409],
    'Exactly one withdrawal should succeed and the other should fail.'
  );

  assert.equal(await readAccountBalance(account.id), 30000n);

  const postedWithdrawals = await prisma.transaction.findMany({
    where: {
      description,
      status: 'POSTED',
    },
  });

  assert.equal(postedWithdrawals.length, 1);
  assert.equal(postedWithdrawals[0].totalAmount, 70000n);

  await assertTransactionIsBalanced(postedWithdrawals[0].id);
  await assertAccountLedgerMatchesBalance(account.id, 'LIABILITY');
  await assertAccountLedgerMatchesBalance(systemCashAccount.id, 'ASSET');

  const refusedAttempts = await prisma.auditLog.count({
    where: {
      entityType: 'ACCOUNT',
      entityId: account.id,
      action: 'WITHDRAWAL_REFUSED',
    },
  });

  assert.ok(refusedAttempts >= 1);
});

test('Ledger conservation: a transfer preserves the combined customer balances', async () => {
  const sender = await createUser();
  const receiver = await createUser();

  const senderAccount = await createCustomerAccount(sender, 'Conservation Sender');
  const receiverAccount = await createCustomerAccount(receiver, 'Conservation Receiver');

  const senderToken = tokenFor(sender);

  const funding = await deposit(
    senderToken,
    senderAccount.id,
    '500.00',
    uniqueValue('conservation-funding'),
    uniqueValue('Conservation Funding')
  );

  assert.equal(funding.status, 201);

  const beforeSender = await readAccountBalance(senderAccount.id);
  const beforeReceiver = await readAccountBalance(receiverAccount.id);
  const totalBefore = beforeSender + beforeReceiver;

  const description = uniqueValue('Conservation Transfer');

  const transfer = await request(app)
    .post('/api/transactions/transfer')
    .set(auth(senderToken))
    .set('Idempotency-Key', uniqueValue('conservation-transfer'))
    .send({
      fromAccountId: senderAccount.id,
      toAccountId: receiverAccount.id,
      amount: '125.00',
      description,
    });

  assert.equal(transfer.status, 201);
  assert.equal(transfer.body.success, true);

  const afterSender = await readAccountBalance(senderAccount.id);
  const afterReceiver = await readAccountBalance(receiverAccount.id);
  const totalAfter = afterSender + afterReceiver;

  assert.equal(afterSender, 37500n);
  assert.equal(afterReceiver, 12500n);
  assert.equal(totalAfter, totalBefore);

  const transactionId = transfer.body.transaction.id;

  await assertTransactionIsBalanced(transactionId);
  await assertAccountLedgerMatchesBalance(senderAccount.id, 'LIABILITY');
  await assertAccountLedgerMatchesBalance(receiverAccount.id, 'LIABILITY');
});

test('Concurrency: transfers in opposite directions both complete without deadlock', async () => {
  const userA = await createUser();
  const userB = await createUser();
  const accountA = await createCustomerAccount(userA, 'Reverse Transfer A');
  const accountB = await createCustomerAccount(userB, 'Reverse Transfer B');
  const tokenA = tokenFor(userA);
  const tokenB = tokenFor(userB);

  const [fundA, fundB] = await Promise.all([
    deposit(tokenA, accountA.id, '100.00', uniqueValue('reverse-fund-a')),
    deposit(tokenB, accountB.id, '100.00', uniqueValue('reverse-fund-b')),
  ]);
  assert.equal(fundA.status, 201);
  assert.equal(fundB.status, 201);

  const [transferAtoB, transferBtoA] = await Promise.all([
    request(app)
      .post('/api/transactions/transfer')
      .set(auth(tokenA))
      .set('Idempotency-Key', uniqueValue('reverse-transfer-a'))
      .send({
        fromAccountId: accountA.id,
        toAccountId: accountB.id,
        amount: '25.00',
      }),
    request(app)
      .post('/api/transactions/transfer')
      .set(auth(tokenB))
      .set('Idempotency-Key', uniqueValue('reverse-transfer-b'))
      .send({
        fromAccountId: accountB.id,
        toAccountId: accountA.id,
        amount: '10.00',
      }),
  ]);

  assert.deepEqual([transferAtoB.status, transferBtoA.status], [201, 201]);
  assert.equal(await readAccountBalance(accountA.id), 8500n);
  assert.equal(await readAccountBalance(accountB.id), 11500n);
  assert.equal(
    (await readAccountBalance(accountA.id)) + (await readAccountBalance(accountB.id)),
    20000n
  );
});

test('Money precision: API preserves paise amounts above JavaScript safe integer range', async () => {
  const user = await createUser();
  const account = await createCustomerAccount(user, 'Large Amount Precision Account');
  const response = await deposit(
    tokenFor(user),
    account.id,
    '90071992547409.93',
    uniqueValue('large-amount-precision')
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.transaction.amountPaise, '9007199254740993');
  assert.equal(await readAccountBalance(account.id), 9007199254740993n);
});

test('Authentication: login and registration endpoints enforce rate limits', async () => {
  const loginAttempts = await Promise.all(
    Array.from({ length: 11 }, (_, index) =>
      request(app)
        .post('/api/auth/login')
        .send({
          email: `rate-limit-${index}@ledgerline-test.example`,
          password: TEST_PASSWORD,
        })
    )
  );

  assert.ok(loginAttempts.some((response) => response.status === 429));

  const registrationAttempts = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    registrationAttempts.push(
      await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Invalid Registration' })
    );
  }

  assert.ok(registrationAttempts.every((response) => response.status === 400));
  const blockedRegistration = await request(app)
    .post('/api/auth/register')
    .send({ fullName: 'Invalid Registration' });
  assert.equal(blockedRegistration.status, 429);
});
