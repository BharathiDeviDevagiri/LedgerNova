
import { Router } from 'express';
import { z } from 'zod';

import prisma from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { formatPaiseToRupees } from '../utils/money.js';

const router = Router();

// All endpoints in this router require an administrator.
router.use(authenticateToken, requireRole('ADMIN'));

const permissionSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['OWNER', 'MANAGER', 'VIEWER']),
}).strict();

async function lockAccountForPermissionChange(tx, accountId) {
  const rows = await tx.$queryRaw`
    SELECT "id" FROM "accounts" WHERE "id" = ${accountId} FOR UPDATE
  `;

  if (rows.length === 0) return null;
  return tx.account.findUnique({ where: { id: accountId } });
}

/**
 * GET /api/admin/metrics
 * System-wide overview metrics.
 */
router.get('/metrics', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalAccounts,
      totalTransactions,
      systemCashAccount,
      customerDepositSum,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.account.count({
        where: { type: 'LIABILITY' },
      }),

      prisma.transaction.count({
        where: { status: 'POSTED' },
      }),

      prisma.account.findUnique({
        where: { accountNumber: 'SYS-BANK-CASH-INR' },
        select: {
          id: true,
          balance: true,
          status: true,
          accountNumber: true,
        },
      }),

      prisma.account.aggregate({
        where: { type: 'LIABILITY' },
        _sum: { balance: true },
      }),

      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const cashBalance = systemCashAccount?.balance || 0n;
    const totalDeposits = customerDepositSum._sum.balance || 0n;

    return res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        totalCustomerAccounts: totalAccounts,
        totalPostedTransactions: totalTransactions,

        systemCashAccount: {
          accountNumber:
            systemCashAccount?.accountNumber || 'SYS-BANK-CASH-INR',
          status: systemCashAccount?.status || 'UNKNOWN',
          balancePaise: cashBalance.toString(),
          balanceRupees: formatPaiseToRupees(cashBalance),
        },

        totalCustomerLiabilities: {
          balancePaise: totalDeposits.toString(),
          balanceRupees: formatPaiseToRupees(totalDeposits),
        },

        reconciliationBalanced: cashBalance === totalDeposits,
      },

      recentActivity: recentAuditLogs,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/admin/users
 * List all users.
 */
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            accountPermissions: true,
            initiatedTransactions: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        accountsCount: user._count.accountPermissions,
        transactionsCount: user._count.initiatedTransactions,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activate or deactivate a user.
 */
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      isActive: z.boolean(),
    }).strict();

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body.',
      });
    }

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot change your own active status.',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive: parsed.data.isActive },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: updatedAction(user.isActive),
          entityType: 'USER',
          entityId: user.id,
          newValues: {
            isActive: user.isActive,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      return user;
    });

    return res.status(200).json({
      success: true,
      message: `User ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
      user: updated,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admin/accounts/:accountId/permissions
 *
 * Assign or update a user's permission for an account.
 *
 * AUDITOR users can ONLY receive VIEWER permission.
 */
router.post('/accounts/:accountId/permissions', async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const parsed = permissionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission details.',
        details: parsed.error.issues,
      });
    }

    const { userId, permission } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const account = await lockAccountForPermissionChange(tx, accountId);
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!account) {
        return {
          status: 404,
          body: {
            success: false,
            error: 'Account not found.',
          },
        };
      }

      if (account.accountNumber === 'SYS-BANK-CASH-INR') {
        return {
          status: 400,
          body: {
            success: false,
            error: 'Permissions cannot be assigned to the internal system account.',
          },
        };
      }

      if (!user) {
        return {
          status: 404,
          body: {
            success: false,
            error: 'User not found.',
          },
        };
      }

      if (!user.isActive) {
        return {
          status: 409,
          body: {
            success: false,
            error: 'Cannot assign permissions to an inactive user.',
          },
        };
      }

      if (user.role === 'AUDITOR' && permission !== 'VIEWER') {
        return {
          status: 400,
          body: {
            success: false,
            error: 'Auditors can only receive VIEWER permission.',
          },
        };
      }

      const assigned = await tx.accountPermission.upsert({
        where: {
          userId_accountId: {
            userId,
            accountId,
          },
        },
        create: {
          userId,
          accountId,
          permission,
        },
        update: {
          permission,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ACCOUNT_PERMISSION_ASSIGNED',
          entityType: 'ACCOUNT',
          entityId: account.id,
          newValues: {
            targetUserId: user.id,
            targetEmail: user.email,
            permission: assigned.permission,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      return {
        status: 200,
        body: {
          success: true,
          message: 'Account permission assigned successfully.',
          permission: {
            userId: assigned.userId,
            accountId: assigned.accountId,
            level: assigned.permission,
          },
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/admin/accounts/:accountId/permissions/:userId
 * Revoke a user's access to an account.
 */
router.delete(
  '/accounts/:accountId/permissions/:userId',
  async (req, res, next) => {
    try {
      const { accountId, userId } = req.params;

      const result = await prisma.$transaction(async (tx) => {
        const account = await lockAccountForPermissionChange(tx, accountId);
        if (!account) {
          return {
            status: 404,
            body: {
              success: false,
              error: 'Account not found.',
            },
          };
        }

        const permission = await tx.accountPermission.findUnique({
          where: {
            userId_accountId: {
              userId,
              accountId,
            },
          },
        });

        if (!permission) {
          return {
            status: 404,
            body: {
              success: false,
              error: 'Account permission not found.',
            },
          };
        }

        await tx.accountPermission.delete({
          where: {
            userId_accountId: {
              userId,
              accountId,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'ACCOUNT_PERMISSION_REVOKED',
            entityType: 'ACCOUNT',
            entityId: account.id,
            newValues: {
              targetUserId: userId,
              previousPermission: permission.permission,
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          },
        });

        return {
          status: 200,
          body: {
            success: true,
            message: 'Account permission revoked successfully.',
          },
        };
      });

      return res.status(result.status).json(result.body);
    } catch (error) {
      return next(error);
    }
  }
);

function updatedAction(isActive) {
  return isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
}

export default router;
