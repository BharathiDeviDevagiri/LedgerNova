import crypto from 'crypto';
import prisma from '../config/prisma.js';

/**
 * Generate a SHA-256 hash of the request payload to ensure payload fidelity.
 * @param {object} body
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function hashPayload(body) {
  const normalized = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Utility promise-based sleep for polling intervals.
 * @param {number} ms Milliseconds to wait
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Update an idempotency record upon transaction completion.
 * @param {object} params
 */
export async function finalizeIdempotencyKey({
  userId,
  key,
  requestPath,
  status, // 'COMPLETED' | 'FAILED'
  responseStatus,
  responseBody,
  txClient = prisma,
}) {
  return txClient.idempotencyKey.update({
    where: {
      userId_key_requestPath: {
        userId,
        key,
        requestPath,
      },
    },
    data: {
      status,
      responseStatus,
      responseBody,
      lockedAt: null,
    },
  });
}

/**
 * DEPRECATED: this middleware is not mounted or used by the transaction routes.
 * Financial routes use runIdempotent() so the idempotency record, ledger
 * posting, audit log and response commit together in one database transaction.
 *
 * Kept temporarily for compatibility with any external imports. Do not mount
 * it on routes; its reservation is outside the financial transaction.
 */
export function requireIdempotency() {
  const MAX_WAIT_MS = 10000;       // Max wait time for concurrent requests (10s)
  const POLL_INTERVAL_MS = 250;    // Database check frequency (4 Hz)
  const STALE_LOCK_MS = 30000;     // Lock timeout to detect crashed processes (30s)
  const RETENTION_MS = 24 * 60 * 60 * 1000; // 24-hour TTL

  return async (req, res, next) => {
    // Only enforce on mutating requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    const idempotencyKey = req.header('Idempotency-Key');
    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required HTTP header: Idempotency-Key',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for idempotent financial operations',
      });
    }

    const requestPath = req.baseUrl + req.path;
    const requestHash = hashPayload(req.body);
    const expiresAt = new Date(Date.now() + RETENTION_MS);

    try {
      let keyRecord = await prisma.idempotencyKey.findUnique({
        where: {
          userId_key_requestPath: {
            userId,
            key: idempotencyKey,
            requestPath,
          },
        },
      });

      // ----------------------------------------------------------------------
      // Scenario A: Existing Key Found
      // ----------------------------------------------------------------------
      if (keyRecord) {
        // 1. Payload Mismatch check
        if (keyRecord.requestHash !== requestHash) {
          return res.status(409).json({
            success: false,
            error:
              'Idempotency key reuse conflict: The provided Idempotency-Key was previously used with a different request payload.',
          });
        }

        // 2. Previously completed -> Replay stored response
        if (keyRecord.status === 'COMPLETED') {
          res.setHeader('Idempotent-Replay', 'true');
          return res.status(keyRecord.responseStatus || 200).json(keyRecord.responseBody);
        }

        // 3. Previously failed -> Replay stored failure response
        if (keyRecord.status === 'FAILED') {
          res.setHeader('Idempotent-Replay', 'true');
          return res.status(keyRecord.responseStatus || 400).json(keyRecord.responseBody);
        }

        // 4. In-flight PENDING request -> Coordinate via PostgreSQL polling
        if (keyRecord.status === 'PENDING') {
          const startTime = Date.now();

          while (Date.now() - startTime < MAX_WAIT_MS) {
            await sleep(POLL_INTERVAL_MS);

            keyRecord = await prisma.idempotencyKey.findUnique({
              where: {
                userId_key_requestPath: {
                  userId,
                  key: idempotencyKey,
                  requestPath,
                },
              },
            });

            if (!keyRecord) break;

            if (keyRecord.status === 'COMPLETED') {
              res.setHeader('Idempotent-Replay', 'true');
              return res.status(keyRecord.responseStatus || 200).json(keyRecord.responseBody);
            }

            if (keyRecord.status === 'FAILED') {
              res.setHeader('Idempotent-Replay', 'true');
              return res.status(keyRecord.responseStatus || 400).json(keyRecord.responseBody);
            }

            // Check if primary request has crashed (lock age > 30s)
            const lockAgeMs = Date.now() - new Date(keyRecord.lockedAt || keyRecord.createdAt).getTime();
            if (lockAgeMs > STALE_LOCK_MS) {
              // Primary request crashed. Attempt to acquire stale lock.
              const recovered = await prisma.idempotencyKey.updateMany({
                where: {
                  userId,
                  key: idempotencyKey,
                  requestPath,
                  status: 'PENDING',
                  lockedAt: keyRecord.lockedAt,
                },
                data: {
                  lockedAt: new Date(),
                  updatedAt: new Date(),
                },
              });

              if (recovered.count > 0) {
                // Lock acquired. Proceed to execute the transaction as primary worker.
                break;
              }
            }
          }

          // If still pending after MAX_WAIT_MS and not stale, notify client to retry
          if (keyRecord && keyRecord.status === 'PENDING') {
            const currentLockAge = Date.now() - new Date(keyRecord.lockedAt || keyRecord.createdAt).getTime();
            if (currentLockAge <= STALE_LOCK_MS) {
              res.setHeader('Retry-After', '2');
              return res.status(425).json({
                success: false,
                error:
                  'Too Early: An identical transaction is currently in progress. Please retry in a few moments.',
              });
            }
          }
        }
      } else {
        // ----------------------------------------------------------------------
        // Scenario B: New Key - Attempt Atomic Reservation
        // ----------------------------------------------------------------------
        try {
          await prisma.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              userId,
              requestPath,
              requestHash,
              status: 'PENDING',
              lockedAt: new Date(),
              expiresAt,
            },
          });
        } catch (insertError) {
          // Simultaneous race condition: another concurrent thread inserted first
          if (insertError.code === 'P2002') {
            // Re-invoke self recursively to enter the waiting coordination loop
            return requireIdempotency()(req, res, next);
          }
          throw insertError;
        }
      }

      // Attach context to request for downstream transaction engine
      req.idempotency = {
        key: idempotencyKey,
        userId,
        requestPath,
        requestHash,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
