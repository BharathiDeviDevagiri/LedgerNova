
import prisma from '../config/prisma.js';
import { formatPaiseToRupees } from '../utils/money.js';

const SYSTEM_ACCOUNT_NUMBER = 'SYS-BANK-CASH-INR';

function buildDateFilter(from, to) {
  const createdAt = {};

  if (from) {
    createdAt.gte = new Date(from);
  }

  if (to) {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(to);

    if (isDateOnly) {
      const endOfDay = new Date(`${to}T23:59:59.999`);
      createdAt.lte = endOfDay;
    } else {
      createdAt.lte = new Date(to);
    }
  }

  return Object.keys(createdAt).length ? { createdAt } : {};
}

function getTransactionOperation(entry, accountNumber) {
  const hasSystemCashEntry =
    entry.transaction.ledgerEntries.some(
      (leg) => leg.account.accountNumber === SYSTEM_ACCOUNT_NUMBER
    );

  if (!hasSystemCashEntry) {
    return 'TRANSFER';
  }

  // When viewing a customer account:
  // CREDIT = deposit, DEBIT = withdrawal.
  if (accountNumber !== SYSTEM_ACCOUNT_NUMBER) {
    return entry.type === 'CREDIT' ? 'DEPOSIT' : 'WITHDRAWAL';
  }

  // When viewing the system cash account, the direction is reversed.
  return entry.type === 'DEBIT' ? 'DEPOSIT' : 'WITHDRAWAL';
}

function sortNewestFirst(a, b) {
  const dateDifference =
    new Date(b.date).getTime() - new Date(a.date).getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return String(b.id).localeCompare(String(a.id));
}

export async function getAccountStatement({
  accountId,
  page = 1,
  limit = 20,
  from,
  to,
}) {
  const account = await prisma.account.findFirst({
    where: {
      OR: [
        { id: accountId },
        { accountNumber: accountId },
      ],
    },
    select: {
      id: true,
      accountNumber: true,
      name: true,
      type: true,
      status: true,
      currency: true,
      balance: true,
    },
  });

  if (!account) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }

  const skip = (page - 1) * limit;

  // We need the first skip + limit records from EACH source.
  // After merging and sorting, we can select the correct global page.
  const windowSize = skip + limit;

  const dateFilter = buildDateFilter(from, to);

  const ledgerWhere = {
    accountId: account.id,
    transaction: {
      status: 'POSTED',
    },
    ...dateFilter,
  };

  const auditWhere = {
    entityType: 'ACCOUNT',
    entityId: {
      in: [account.id, account.accountNumber],
    },
    action: {
      endsWith: '_REFUSED',
    },
    ...dateFilter,
  };

  const [
    totalLedgerCount,
    totalRefusedCount,
    ledgerEntries,
    refusedAttempts,
  ] = await Promise.all([
    prisma.ledgerEntry.count({
      where: ledgerWhere,
    }),

    prisma.auditLog.count({
      where: auditWhere,
    }),

    prisma.ledgerEntry.findMany({
      where: ledgerWhere,
      include: {
        transaction: {
          include: {
            actor: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            ledgerEntries: {
              include: {
                account: {
                  select: {
                    accountNumber: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: windowSize,
    }),

    prisma.auditLog.findMany({
      where: auditWhere,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: windowSize,
    }),
  ]);

  const totalItems = totalLedgerCount + totalRefusedCount;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  const postedItems = ledgerEntries.map((entry) => {
    const operation = getTransactionOperation(
      entry,
      account.accountNumber
    );

    return {
      id: entry.id,
      kind: 'LEDGER_ENTRY',
      date: entry.createdAt,
      reference: entry.transaction.referenceNumber,
      transactionId: entry.transactionId,
      description: entry.transaction.description,
      operation,
      type: entry.type,
      status: 'POSTED',
      amountPaise: entry.amount.toString(),
      amount: formatPaiseToRupees(entry.amount),
      runningBalancePaise: entry.runningBalance.toString(),
      runningBalance: formatPaiseToRupees(entry.runningBalance),
      initiator: entry.transaction.actor,
      refusalReason: null,
    };
  });

  const refusedItems = refusedAttempts.map((attempt) => {
    const values = attempt.newValues || {};

    let amountPaise = '0';

    try {
      amountPaise = BigInt(values.amountPaise ?? '0').toString();
    } catch {
      amountPaise = '0';
    }

    const amount = BigInt(amountPaise);
    const operation = attempt.action.replace(/_REFUSED$/, '');

    return {
      id: attempt.id,
      kind: 'REFUSED_ATTEMPT',
      date: attempt.createdAt,
      reference: null,
      transactionId: null,
      description: `${operation} (Refused)`,
      operation,
      type: 'REFUSED',
      status: 'REFUSED',
      amountPaise,
      amount: formatPaiseToRupees(amount),
      // Refused attempts do not have a posted ledger balance.
      runningBalancePaise: null,
      runningBalance: null,
      initiator: attempt.user
        ? {
            id: attempt.user.id,
            fullName: attempt.user.fullName,
            email: attempt.user.email,
          }
        : null,
      refusalReason: values.reason || null,
    };
  });

  // Merge both sources into one chronological timeline.
  const combined = [
    ...postedItems,
    ...refusedItems,
  ].sort(sortNewestFirst);

  // Apply pagination AFTER merging and sorting.
  const entries = combined.slice(skip, skip + limit);

  return {
    account: {
      id: account.id,
      accountNumber: account.accountNumber,
      name: account.name,
      type: account.type,
      status: account.status,
      currency: account.currency,
      currentBalancePaise: account.balance.toString(),
      currentBalance: formatPaiseToRupees(account.balance),
    },
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasMore: page < totalPages,
    },
    entries,
  };
}
