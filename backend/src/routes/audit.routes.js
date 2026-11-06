import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Only ADMIN and AUDITOR roles can view audit logs
router.use(authenticateToken, requireRole('ADMIN', 'AUDITOR'));

/**
 * GET /api/audit-logs
 * List system audit trail entries.
 */
router.get('/', async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      action: z.string().optional(),
      entityType: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters.',
      });
    }

    const { page, limit, action, entityType, from, to } = parsed.data;

    const dateFilter = {};
    if (from && !Number.isNaN(Date.parse(from))) dateFilter.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) dateFilter.lte = new Date(to);

    const where = {
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(entityType && { entityType }),
      ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
    };

    const [totalItems, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
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
      logs,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
