import { Router } from 'express';
import { z } from 'zod';

import prisma from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { formatPaiseToRupees } from '../utils/money.js';

import {
  deposit,
  withdraw,
  transfer,
} from '../services/transaction.service.js';

const router = Router();

const amountSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)(\.\d{1,2})?$/,
    'Amount must be a positive rupee amount with at most two decimal places.'
  )
  .refine((value) => {
    try {
      return BigInt(value.split('.')[0]) * 100n +
        BigInt((value.split('.')[1] || '').padEnd(2, '0') || '0') > 0n;
    } catch {
      return false;
    }
  }, 'Amount must be greater than zero.');

const descriptionSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .optional();

const depositSchema = z.object({
  accountId: z.string().uuid(),
  amount: amountSchema,
  description: descriptionSchema,
}).strict();

const withdrawalSchema = z.object({
  accountId: z.string().uuid(),
  amount: amountSchema,
  description: descriptionSchema,
}).strict();

const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: amountSchema,
  description: descriptionSchema,
}).strict();

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body.',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    req.validatedBody = result.data;
    return next();
  };
}

function getRequestContext(req) {
  const key = req.get('Idempotency-Key');

  if (!key || key.length > 128) {
    const error = new Error(
      'Provide an Idempotency-Key header containing 1 to 128 characters.'
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    userId: req.user.id,
    key,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

function sendOperationResult(res, result) {
  return res.status(result.statusCode).json({
    ...result.body,
    replayed: result.replayed,
  });
}

/**
 * POST /api/transactions/deposit
 */
router.post(
  '/deposit',
  authenticateToken,
  validateBody(depositSchema),
  async (req, res, next) => {
    try {
      const result = await deposit({
        ...getRequestContext(req),
        ...req.validatedBody,
      });

      return sendOperationResult(res, result);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/transactions/withdraw
 */
router.post(
  '/withdraw',
  authenticateToken,
  validateBody(withdrawalSchema),
  async (req, res, next) => {
    try {
      const result = await withdraw({
        ...getRequestContext(req),
        ...req.validatedBody,
      });

      return sendOperationResult(res, result);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/transactions/transfer
 */
router.post(
  '/transfer',
  authenticateToken,
  validateBody(transferSchema),
  async (req, res, next) => {
    try {
      const result = await transfer({
        ...getRequestContext(req),
        ...req.validatedBody,
      });

      return sendOperationResult(res, result);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/transactions
 * Retrieve transaction history with pagination and date/status filters.
 * Scoped to assigned accounts for ACCOUNT_HOLDER and AUDITOR; global for ADMIN.
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['PENDING', 'POSTED', 'FAILED']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    });

    const queryResult = querySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters.',
        details: queryResult.error.issues,
      });
    }

    const { page, limit, status, from, to } = queryResult.data;
    const isAdmin = req.user.role === 'ADMIN';

    const dateFilter = {};
    if (from && !Number.isNaN(Date.parse(from))) dateFilter.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) dateFilter.lte = new Date(to);

    const accountPermissionFilter = {
      ledgerEntries: {
        some: {
          account: {
            permissions: {
              some: { userId: req.user.id },
            },
          },
        },
      },
    };

    const where = {
      ...(status && { status }),
      ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
      ...(!isAdmin && (req.user.role === 'AUDITOR'
        ? accountPermissionFilter
        : {
            OR: [
              { actorId: req.user.id },
              accountPermissionFilter,
            ],
          })),
    };

    const [totalItems, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
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
                  id: true,
                  accountNumber: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasMore: page < totalPages,
      },
      transactions: transactions.map((tx) => ({
        id: tx.id,
        referenceNumber: tx.referenceNumber,
        description: tx.description,
        status: tx.status,
        totalAmountPaise: tx.totalAmount.toString(),
        totalAmountRupees: formatPaiseToRupees(tx.totalAmount),
        postedAt: tx.postedAt,
        createdAt: tx.createdAt,
        initiator: tx.actor,
        entriesCount: tx.ledgerEntries.length,
        entries: tx.ledgerEntries.map((e) => ({
          id: e.id,
          accountId: e.accountId,
          accountNumber: e.account.accountNumber,
          accountName: e.account.name,
          accountType: e.account.type,
          type: e.type,
          amountPaise: e.amount.toString(),
          amountRupees: formatPaiseToRupees(e.amount),
          runningBalancePaise: e.runningBalance.toString(),
          runningBalanceRupees: formatPaiseToRupees(e.runningBalance),
        })),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/transactions/:id
 * Retrieve specific transaction details with balanced double-entry ledger entries.
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const transaction = await prisma.transaction.findFirst({
      where: isUuid
        ? { OR: [{ id }, { referenceNumber: id }] }
        : { referenceNumber: id },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        ledgerEntries: {
          include: {
            account: {
              select: {
                id: true,
                accountNumber: true,
                name: true,
                type: true,
                currency: true,
                permissions: {
                  select: { userId: true, permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found.',
      });
    }

    // Access control
    const isAdmin = req.user.role === 'ADMIN';
    const isActor = transaction.actorId === req.user.id;
    const hasAccountAccess = transaction.ledgerEntries.some((entry) =>
      entry.account.permissions.some((p) => p.userId === req.user.id)
    );

    const canReadTransaction = isAdmin ||
      (req.user.role === 'AUDITOR'
        ? hasAccountAccess
        : isActor || hasAccountAccess);

    if (!canReadTransaction) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this transaction.',
      });
    }

    return res.status(200).json({
      success: true,
      transaction: {
        id: transaction.id,
        referenceNumber: transaction.referenceNumber,
        description: transaction.description,
        status: transaction.status,
        totalAmountPaise: transaction.totalAmount.toString(),
        totalAmountRupees: formatPaiseToRupees(transaction.totalAmount),
        postedAt: transaction.postedAt,
        createdAt: transaction.createdAt,
        initiator: transaction.actor,
        entries: transaction.ledgerEntries.map((e) => ({
          id: e.id,
          accountId: e.accountId,
          accountNumber: e.account.accountNumber,
          accountName: e.account.name,
          accountType: e.account.type,
          type: e.type,
          amountPaise: e.amount.toString(),
          amountRupees: formatPaiseToRupees(e.amount),
          runningBalancePaise: e.runningBalance.toString(),
          runningBalanceRupees: formatPaiseToRupees(e.runningBalance),
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
