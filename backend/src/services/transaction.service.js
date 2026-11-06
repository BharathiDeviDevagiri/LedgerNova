import crypto from 'node:crypto';

import prisma from '../config/prisma.js';
import { parseRupeesToPaise } from '../utils/money.js';

import {
  lockAccount,
  authorizeAccountDebit,
  validateCustomerAccount,
  getSystemCashAccount,
  calculateNextBalance,
} from './account.service.js';

import { runIdempotent } from './idempotency.service.js';

const SYSTEM_ACCOUNT_NUMBER = 'SYS-BANK-CASH-INR';

/**
 * Standard response for a refused financial operation.
 */
function failure(statusCode, error, reason) {
  return {
    failed: true,
    statusCode,
    body: {
      success: false,
      error,
      reason,
    },
  };
}

/**
 * Record a refused operation.
 * This is an audit event, not a posted financial transaction.
 */
async function recordRefusedAttempt(
  tx,
  userId,
  accountId,
  action,
  amount,
  reason,
  context = {}
) {
  await tx.auditLog.create({
    data: {
      userId,
      action: `${action}_REFUSED`,
      entityType: 'ACCOUNT',
      entityId: accountId || 'UNKNOWN',
      newValues: {
        amountPaise: amount.toString(),
        reason,
      },
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    },
  });
}

/**
 * Lock multiple accounts in deterministic ID order.
 * This reduces deadlock risk when two operations involve
 * the same accounts in opposite directions.
 */
async function lockAccounts(tx, accountIds) {
  const uniqueIds = [...new Set(accountIds)].sort();
  const accounts = new Map();

  for (const id of uniqueIds) {
    const account = await lockAccount(tx, id);

    if (account) {
      accounts.set(id, account);
    }
  }

  return accounts;
}

/**
 * Create one balanced, posted double-entry transaction.
 *
 * All account balance updates, ledger entries, transaction records
 * and audit records run inside the same PostgreSQL transaction.
 */

async function postFinancialTransaction(
  tx,
  {
    userId,
    description,
    amount,
    entries,
    context,
    operation,
  }
) {
  const calculatedEntries = [];

  for (const entry of entries) {
    const result = calculateNextBalance(
      entry.account,
      entry.type,
      amount
    );

    if (!result.valid) {
      // Identify the account whose balance check failed.
      await recordRefusedAttempt(
        tx,
        userId,
        entry.account.id,
        operation,
        amount,
        result.reason,
        context
      );

      return failure(
        409,
        'Insufficient available balance.',
        result.reason
      );
    }

    calculatedEntries.push({
      account: entry.account,
      type: entry.type,
      amount,
      runningBalance: result.balance,
    });
  }

  const transaction = await tx.transaction.create({
    data: {
      referenceNumber: `LL-${crypto.randomUUID()}`,
      description,
      status: 'PENDING',
      totalAmount: amount,
      actorId: userId,
    },
  });

  for (const entry of calculatedEntries) {
    await tx.account.update({
      where: { id: entry.account.id },
      data: {
        balance: entry.runningBalance,
        version: { increment: 1 },
      },
    });
  }

  await tx.ledgerEntry.createMany({
    data: calculatedEntries.map((entry) => ({
      transactionId: transaction.id,
      accountId: entry.account.id,
      type: entry.type,
      amount: entry.amount,
      runningBalance: entry.runningBalance,
    })),
  });

  await tx.transaction.update({
    where: { id: transaction.id },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
    },
  });

  await tx.auditLog.create({
    data: {
      userId,
      action: `${operation}_POSTED`,
      entityType: 'TRANSACTION',
      entityId: transaction.id,
      newValues: {
        referenceNumber: transaction.referenceNumber,
        amountPaise: amount.toString(),
        accountIds: calculatedEntries.map(
          (entry) => entry.account.id
        ),
      },
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    },
  });

  return {
    failed: false,
    statusCode: 201,
    body: {
      success: true,
      message: 'Transaction posted successfully.',
      transaction: {
        id: transaction.id,
        referenceNumber: transaction.referenceNumber,
        operation,
        amountPaise: amount.toString(),
        status: 'POSTED',
        postedAt: new Date().toISOString(),
      },
      balances: calculatedEntries.map((entry) => ({
        accountId: entry.account.id,
        balancePaise: entry.runningBalance.toString(),
      })),
    },
  };
}

/**
 * Deposit money into a customer account.
 *
 * Debit:  Bank cash (ASSET)
 * Credit: Customer account (LIABILITY)
 */
export async function deposit({
  userId,
  key,
  accountId,
  amount: amountInput,
  description,
  ipAddress,
  userAgent,
}) {
  const amount = parseRupeesToPaise(amountInput);

  const requestBody = {
    accountId,
    amount: amountInput,
    description: description || 'Cash deposit',
  };

  return runIdempotent({
    userId,
    key,
    requestPath: '/api/transactions/deposit',
    requestBody,
    execute: async (tx) => {
      const systemAccount = await getSystemCashAccount(tx);

      if (!systemAccount) {
        throw new Error('System bank cash account is missing.');
      }

      const locked = await lockAccounts(tx, [
        accountId,
        systemAccount.id,
      ]);

      const customer = locked.get(accountId);
      const cash = locked.get(systemAccount.id);

      if (!customer) {
        await recordRefusedAttempt(
          tx, userId, accountId, 'DEPOSIT',
          amount, 'ACCOUNT_NOT_FOUND',
          { ipAddress, userAgent }
        );

        return failure(404, 'Account not found.', 'ACCOUNT_NOT_FOUND');
      }

      const validation = validateCustomerAccount(customer);

      if (!validation.valid) {
        await recordRefusedAttempt(
          tx, userId, accountId, 'DEPOSIT',
          amount, validation.reason,
          { ipAddress, userAgent }
        );

        return failure(409, 'Account cannot receive deposits.', validation.reason);
      }

      const authorization = await authorizeAccountDebit(
        tx,
        userId,
        customer
      );

      if (!authorization.allowed) {
        await recordRefusedAttempt(
          tx, userId, accountId, 'DEPOSIT',
          amount, authorization.reason,
          { ipAddress, userAgent }
        );

        return failure(403, 'You are not authorized to operate this account.', authorization.reason);
      }

      if (
        !cash ||
        cash.status !== 'ACTIVE' ||
        cash.type !== 'ASSET' ||
        cash.currency !== 'INR' ||
        cash.accountNumber !== SYSTEM_ACCOUNT_NUMBER
      ) {
        throw new Error('System bank cash account configuration is invalid.');
      }

      return postFinancialTransaction(tx, {
        userId,
        description: description || 'Cash deposit',
        amount,
        operation: 'DEPOSIT',
        context: { ipAddress, userAgent },
        entries: [
          { account: cash, type: 'DEBIT' },
          { account: customer, type: 'CREDIT' },
        ],
      });
    },
  });
}

/**
 * Withdraw money from a customer account.
 *
 * Debit:  Customer account (LIABILITY)
 * Credit: Bank cash (ASSET)
 */
export async function withdraw({
  userId,
  key,
  accountId,
  amount: amountInput,
  description,
  ipAddress,
  userAgent,
}) {
  const amount = parseRupeesToPaise(amountInput);

  const requestBody = {
    accountId,
    amount: amountInput,
    description: description || 'Cash withdrawal',
  };

  return runIdempotent({
    userId,
    key,
    requestPath: '/api/transactions/withdraw',
    requestBody,
    execute: async (tx) => {
      const systemAccount = await getSystemCashAccount(tx);

      if (!systemAccount) {
        throw new Error('System bank cash account is missing.');
      }

      const locked = await lockAccounts(tx, [
        accountId,
        systemAccount.id,
      ]);

      const customer = locked.get(accountId);
      const cash = locked.get(systemAccount.id);

      if (!customer) {
        await recordRefusedAttempt(
          tx, userId, accountId, 'WITHDRAWAL',
          amount, 'ACCOUNT_NOT_FOUND',
          { ipAddress, userAgent }
        );

        return failure(404, 'Account not found.', 'ACCOUNT_NOT_FOUND');
      }

      const validation = validateCustomerAccount(customer);

      if (!validation.valid) {
        await recordRefusedAttempt(
          tx, userId, accountId, 'WITHDRAWAL',
          amount, validation.reason,
          { ipAddress, userAgent }
        );

        return failure(409, 'Account cannot be used for withdrawal.', validation.reason);
      }

      const authorization = await authorizeAccountDebit(
        tx,
        userId,
        customer
      );

      if (!authorization.allowed) {
        await recordRefusedAttempt(
          tx, userId, accountId, 'WITHDRAWAL',
          amount, authorization.reason,
          { ipAddress, userAgent }
        );

        return failure(403, 'You are not authorized to operate this account.', authorization.reason);
      }

      if (
        !cash ||
        cash.status !== 'ACTIVE' ||
        cash.type !== 'ASSET' ||
        cash.currency !== 'INR' ||
        cash.accountNumber !== SYSTEM_ACCOUNT_NUMBER
      ) {
        throw new Error('System bank cash account configuration is invalid.');
      }

      return postFinancialTransaction(tx, {
        userId,
        description: description || 'Cash withdrawal',
        amount,
        operation: 'WITHDRAWAL',
        context: { ipAddress, userAgent },
        entries: [
          { account: customer, type: 'DEBIT' },
          { account: cash, type: 'CREDIT' },
        ],
      });
    },
  });
}

/**
 * Transfer money between two customer accounts.
 *
 * Debit:  Sender liability
 * Credit: Receiver liability
 *
 * Only the sender needs debit permission.
 */
export async function transfer({
  userId,
  key,
  fromAccountId,
  toAccountId,
  amount: amountInput,
  description,
  ipAddress,
  userAgent,
}) {
  const amount = parseRupeesToPaise(amountInput);

  const requestBody = {
    fromAccountId,
    toAccountId,
    amount: amountInput,
    description: description || 'Account transfer',
  };

  return runIdempotent({
    userId,
    key,
    requestPath: '/api/transactions/transfer',
    requestBody,
    execute: async (tx) => {
      if (fromAccountId === toAccountId) {
        await recordRefusedAttempt(
          tx, userId, fromAccountId, 'TRANSFER',
          amount, 'SAME_ACCOUNT_TRANSFER',
          { ipAddress, userAgent }
        );

        return failure(400, 'Source and destination accounts must be different.', 'SAME_ACCOUNT_TRANSFER');
      }

      const locked = await lockAccounts(tx, [
        fromAccountId,
        toAccountId,
      ]);

      const sender = locked.get(fromAccountId);
      const receiver = locked.get(toAccountId);

      if (!sender || !receiver) {
        await recordRefusedAttempt(
          tx, userId, fromAccountId, 'TRANSFER',
          amount, 'ACCOUNT_NOT_FOUND',
          { ipAddress, userAgent }
        );

        return failure(404, 'Source or destination account not found.', 'ACCOUNT_NOT_FOUND');
      }

      const senderValidation = validateCustomerAccount(sender);
      const receiverValidation = validateCustomerAccount(receiver);

      if (!senderValidation.valid || !receiverValidation.valid) {
        const reason = !senderValidation.valid
          ? senderValidation.reason
          : receiverValidation.reason;

        await recordRefusedAttempt(
          tx, userId, fromAccountId, 'TRANSFER',
          amount, reason,
          { ipAddress, userAgent }
        );

        return failure(409, 'One or both accounts cannot participate in this transfer.', reason);
      }

      const authorization = await authorizeAccountDebit(
        tx,
        userId,
        sender
      );

      if (!authorization.allowed) {
        await recordRefusedAttempt(
          tx, userId, fromAccountId, 'TRANSFER',
          amount, authorization.reason,
          { ipAddress, userAgent }
        );

        return failure(403, 'You are not authorized to debit the source account.', authorization.reason);
      }

      return postFinancialTransaction(tx, {
        userId,
        description: description || 'Account transfer',
        amount,
        operation: 'TRANSFER',
        context: { ipAddress, userAgent },
        entries: [
          { account: sender, type: 'DEBIT' },
          { account: receiver, type: 'CREDIT' },
        ],
      });
    },
  });
}
