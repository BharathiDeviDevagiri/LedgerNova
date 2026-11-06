
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';

import prisma from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { getAccountStatement } from '../services/statement.service.js';
import { formatPaiseToRupees } from '../utils/money.js';

const router = Router({ mergeParams: true });

const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(120),
}).strict();

function generateAccountNumber() {
  return `LL${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function findAccount(accountId) {
  return prisma.account.findFirst({
    where: isUuid(accountId)
      ? {
          OR: [
            { id: accountId },
            { accountNumber: accountId },
          ],
        }
      : { accountNumber: accountId },
  });
}

/**
 * Check whether the current user can read an account.
 * ADMIN can read every account.
 * Other roles must have an explicit account permission.
 */
async function canReadAccount(user, accountId) {
  if (user.role === 'ADMIN') {
    return true;
  }

  const permission = await prisma.accountPermission.findUnique({
    where: {
      userId_accountId: {
        userId: user.id,
        accountId,
      },
    },
  });

  return Boolean(permission);
}

/**
 * POST /api/accounts
 * Create a customer account.
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.role === 'AUDITOR') {
      return res.status(403).json({
        success: false,
        error: 'Auditors have read-only access and cannot create accounts.',
      });
    }

    const parsed = createAccountSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account details.',
        details: parsed.error.issues,
      });
    }

    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: {
          accountNumber: generateAccountNumber(),
          name: parsed.data.name,
          type: 'LIABILITY',
          status: 'ACTIVE',
          currency: 'INR',
          balance: 0n,
        },
      });

      await tx.accountPermission.create({
        data: {
          userId: req.user.id,
          accountId: created.id,
          permission: 'OWNER',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ACCOUNT_CREATED',
          entityType: 'ACCOUNT',
          entityId: created.id,
          newValues: {
            accountNumber: created.accountNumber,
            name: created.name,
            type: created.type,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        name: account.name,
        type: account.type,
        status: account.status,
        currency: account.currency,
        balancePaise: account.balance.toString(),
        balanceRupees: formatPaiseToRupees(account.balance),
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/accounts
 * ADMIN: all accounts.
 * ACCOUNT_HOLDER and AUDITOR: explicitly assigned accounts only.
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';

    const accounts = await prisma.account.findMany({
      where: isAdmin
        ? {}
        : {
            permissions: {
              some: {
                userId: req.user.id,
              },
            },
          },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        accountNumber: true,
        name: true,
        type: true,
        status: true,
        currency: true,
        balance: true,
        createdAt: true,
        permissions: {
          where: isAdmin
            ? {}
            : { userId: req.user.id },
          select: {
            permission: true,
            userId: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: accounts.length,
      accounts: accounts.map((account) => ({
        id: account.id,
        accountNumber: account.accountNumber,
        name: account.name,
        type: account.type,
        status: account.status,
        currency: account.currency,
        balancePaise: account.balance.toString(),
        balanceRupees: formatPaiseToRupees(account.balance),
        permission:
          account.permissions[0]?.permission ||
          (isAdmin ? 'VIEWER' : null),
        createdAt: account.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/accounts/:accountId/statement
 * GET /api/accounts/:accountId/statements
 *
 * ADMIN: all accounts.
 * Other users: only explicitly assigned accounts.
 */
async function handleAccountStatement(req, res, next) {
  try {
    const { accountId } = req.params;

    if (!accountId || typeof accountId !== 'string' || !accountId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A valid account identifier is required.',
      });
    }

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      from: z.string().optional(),
      to: z.string().optional(),
    }).strict();

    const queryResult = querySchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid statement query parameters.',
        details: queryResult.error.issues,
      });
    }

    const { page, limit, from, to } = queryResult.data;

    if (
      (from && Number.isNaN(Date.parse(from))) ||
      (to && Number.isNaN(Date.parse(to)))
    ) {
      return res.status(400).json({
        success: false,
        error: 'Date filters must be valid date strings.',
      });
    }

    if (from && to && new Date(from) > new Date(to)) {
      return res.status(400).json({
        success: false,
        error: '"from" date cannot be later than "to" date.',
      });
    }

    const account = await findAccount(accountId);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found.',
      });
    }

    const authorized = await canReadAccount(req.user, account.id);

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this account statement.',
      });
    }

    const statement = await getAccountStatement({
      accountId: account.id,
      page,
      limit,
      from,
      to,
    });

    return res.status(200).json({
      success: true,
      ...statement,
    });
  } catch (error) {
    return next(error);
  }
}

router.get('/:accountId/statement', authenticateToken, handleAccountStatement);
router.get('/:accountId/statements', authenticateToken, handleAccountStatement);

/**
 * GET /api/accounts/:accountId
 * ADMIN: any account.
 * Other users: explicitly assigned accounts only.
 */
router.get('/:accountId', authenticateToken, async (req, res, next) => {
  try {
    const { accountId } = req.params;

    if (!accountId || typeof accountId !== 'string' || !accountId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A valid account identifier is required.',
      });
    }

    const account = await findAccount(accountId);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found.',
      });
    }

    const authorized = await canReadAccount(req.user, account.id);

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to access this account.',
      });
    }

    const permissions = req.user.role === 'ADMIN'
      ? await prisma.accountPermission.findMany({
          where: { accountId: account.id },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        })
      : [];

    const userPermission = await prisma.accountPermission.findUnique({
      where: {
        userId_accountId: {
          userId: req.user.id,
          accountId: account.id,
        },
      },
    });

    return res.status(200).json({
      success: true,
      account: {
        id: account.id,
        accountNumber: account.accountNumber,
        name: account.name,
        type: account.type,
        status: account.status,
        currency: account.currency,
        balancePaise: account.balance.toString(),
        balanceRupees: formatPaiseToRupees(account.balance),
        permission: userPermission?.permission ||
          (req.user.role === 'ADMIN' ? 'VIEWER' : null),
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        permissions: req.user.role === 'ADMIN'
          ? permissions
          : undefined,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
