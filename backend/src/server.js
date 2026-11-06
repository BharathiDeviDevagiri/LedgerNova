import 'dotenv/config';

import app from './app.js';
import prisma from './config/prisma.js';

const PORT = Number(process.env.PORT || 5000);

function validateEnvironment() {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      'JWT_SECRET is missing or too short. Configure a random secret of at least 32 characters.'
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (
    !Number.isInteger(PORT) ||
    PORT < 1 ||
    PORT > 65535
  ) {
    throw new Error('PORT must be a valid port number.');
  }
}

async function bootstrap() {
  let server;

  try {
    validateEnvironment();

    // Confirm that PostgreSQL is reachable before accepting requests.
    await prisma.$connect();

    console.log('[LedgerLine] PostgreSQL connected.');

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log('======================================');
      console.log(`LedgerLine API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log('======================================');
    });

    server.on('error', async (error) => {
      console.error('[LedgerLine] Server error:', error);

      await prisma.$disconnect();

      process.exit(1);
    });

    let shuttingDown = false;

    const shutdown = async (signal) => {
      if (shuttingDown) return;

      shuttingDown = true;

      console.log(`[LedgerLine] Received ${signal}. Shutting down...`);

      server.close(async (error) => {
        if (error) {
          console.error('[LedgerLine] Shutdown error:', error);
          process.exitCode = 1;
        }

        await prisma.$disconnect();

        console.log('[LedgerLine] Database connection closed.');
      });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[LedgerLine] Startup failed:', error.message);

    await prisma.$disconnect();

    process.exitCode = 1;
  }
}

bootstrap();