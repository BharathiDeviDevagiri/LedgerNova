import { Router } from 'express';
import prisma from '../config/prisma.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();

    await prisma.$queryRaw`SELECT 1`;

    const latencyMs = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      status: 'healthy',
      service: 'ledgerline-backend',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        latencyMs,
      },
    });
  } catch (error) {
    console.error('[Health Check] Database connection failed:', error);

    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      service: 'ledgerline-backend',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
      },
    });
  }
});

export default router;