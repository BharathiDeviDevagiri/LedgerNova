import prisma from '../config/prisma.js';

const SYSTEM_ACCOUNT_NUMBER = 'SYS-BANK-CASH-INR';

/**
 * Load an account after acquiring a PostgreSQL row lock.
 * This prevents concurrent transactions from reading and spending
 * the same outdated balance.
 */
export async function lockAccount(tx, accountId) {
  const rows = await tx.$queryRaw`
    SELECT "id"
    FROM "accounts"
    WHERE "id" = ${accountId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    return null;
  }

  return tx.account.findUnique({
    where: { id: accountId },
  });
}

/**
 * Check whether a user can debit an account.
 * Authorization is checked inside the financial transaction.
 */
export async function authorizeAccountDebit(tx, userId, account) {
  await tx.$queryRaw`
    SELECT "id" FROM "users" WHERE "id" = ${userId} FOR SHARE
  `;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return {
      allowed: false,
      reason: 'USER_INACTIVE',
    };
  }

  if (user.role === 'ADMIN') {
    return { allowed: true };
  }

  if (user.role === 'AUDITOR') {
    return {
      allowed: false,
      reason: 'READ_ONLY_ROLE',
    };
  }

  if (account.accountNumber === SYSTEM_ACCOUNT_NUMBER) {
    return {
      allowed: false,
      reason: 'SYSTEM_ACCOUNT_RESTRICTED',
    };
  }

  const permission = await tx.accountPermission.findUnique({
    where: {
      userId_accountId: {
        userId,
        accountId: account.id,
      },
    },
  });

  if (
    !permission ||
    !['OWNER', 'MANAGER'].includes(permission.permission)
  ) {
    return {
      allowed: false,
      reason: 'INSUFFICIENT_ACCOUNT_PERMISSION',
    };
  }

  return { allowed: true };
}

/**
 * Validate that an account can participate in a customer transaction.
 */
export function validateCustomerAccount(account) {
  if (!account) {
    return {
      valid: false,
      reason: 'ACCOUNT_NOT_FOUND',
    };
  }

  if (account.accountNumber === SYSTEM_ACCOUNT_NUMBER) {
    return {
      valid: false,
      reason: 'SYSTEM_ACCOUNT_RESTRICTED',
    };
  }

  if (account.status !== 'ACTIVE') {
    return {
      valid: false,
      reason: 'ACCOUNT_NOT_ACTIVE',
    };
  }

  if (account.type !== 'LIABILITY') {
    return {
      valid: false,
      reason: 'INVALID_ACCOUNT_TYPE',
    };
  }

  if (account.currency !== 'INR') {
    return {
      valid: false,
      reason: 'UNSUPPORTED_CURRENCY',
    };
  }

  return { valid: true };
}

/**
 * Load the internal bank cash account.
 */
export async function getSystemCashAccount(tx) {
  return tx.account.findUnique({
    where: {
      accountNumber: SYSTEM_ACCOUNT_NUMBER,
    },
  });
}

/**
 * Calculate the new normal-side account balance.
 *
 * ASSET and EXPENSE:
 * Debit increases; credit decreases.
 *
 * LIABILITY, EQUITY and REVENUE:
 * Credit increases; debit decreases.
 */
export function calculateNextBalance(account, entryType, amount) {
  const debitNormal = ['ASSET', 'EXPENSE'].includes(account.type);

  const increasesBalance =
    (debitNormal && entryType === 'DEBIT') ||
    (!debitNormal && entryType === 'CREDIT');

  const nextBalance = increasesBalance
    ? account.balance + amount
    : account.balance - amount;

  if (nextBalance < 0n) {
    return {
      valid: false,
      reason: 'INSUFFICIENT_FUNDS',
    };
  }

  return {
    valid: true,
    balance: nextBalance,
  };
}
