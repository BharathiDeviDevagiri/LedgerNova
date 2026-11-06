import crypto from 'node:crypto';
import prisma from '../config/prisma.js';

const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Produce deterministic JSON so property order does not change the hash.
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

export function hashRequestBody(body) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(body ?? {}))
    .digest('hex');
}

/**
 * Execute one operation under a PostgreSQL transaction-scoped advisory lock.
 *
 * The idempotency record, financial changes, audit log and saved response
 * must all be committed in the same database transaction.
 *
 * execute(tx) must return:
 * {
 *   statusCode: number,
 *   body: JSON-serializable object,
 *   failed?: boolean
 * }
 *
 * Business failures should be returned with failed: true rather than thrown.
 * Unexpected errors should be thrown so the entire database transaction rolls back.
 */
export async function runIdempotent({
  userId,
  key,
  requestPath,
  requestBody,
  execute,
}) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('A valid authenticated user ID is required.');
  }

  if (
    typeof key !== 'string' ||
    key.length < 1 ||
    key.length > 128
  ) {
    throw Object.assign(
      new Error('Idempotency-Key must contain between 1 and 128 characters.'),
      { statusCode: 400 }
    );
  }

  if (
    typeof requestPath !== 'string' ||
    requestPath.length < 1 ||
    requestPath.length > 200
  ) {
    throw new TypeError('A valid request path is required.');
  }

  if (typeof execute !== 'function') {
    throw new TypeError('An operation callback is required.');
  }

  const requestHash = hashRequestBody(requestBody);

  // A signed 64-bit hash is used as the PostgreSQL advisory lock key.
  const lockScope = `${userId}:${key}:${requestPath}`;
  const lockId = crypto
    .createHash('sha256')
    .update(lockScope)
    .digest()
    .readBigInt64BE(0);

  return prisma.$transaction(async (tx) => {
    // This lock is automatically released when the DB transaction ends.
    await tx.$queryRaw`
      SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(${lockId})) AS lock_result
    `;

    const existing = await tx.idempotencyKey.findUnique({
      where: {
        userId_key_requestPath: {
          userId,
          key,
          requestPath,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return {
          replayed: false,
          statusCode: 409,
          body: {
            success: false,
            error: 'This Idempotency-Key was already used with a different request payload.',
          },
        };
      }

      if (
        existing.status === 'COMPLETED' ||
        existing.status === 'FAILED'
      ) {
        return {
          replayed: true,
          statusCode: existing.responseStatus || 200,
          body: existing.responseBody,
        };
      }

      // PENDING records created by the previous middleware are not safe
      // to steal. They require investigation rather than timeout takeover.
      return {
        replayed: false,
        statusCode: 503,
        body: {
          success: false,
          error: 'An unfinished idempotency record exists. Please retry after investigation.',
        },
      };
    }

    const record = await tx.idempotencyKey.create({
      data: {
        userId,
        key,
        requestPath,
        requestHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + RETENTION_MS),
      },
    });

    const result = await execute(tx);

    if (
      !result ||
      !Number.isInteger(result.statusCode) ||
      result.statusCode < 200 ||
      result.statusCode > 599
    ) {
      throw new Error('The transaction operation returned an invalid response.');
    }

    // Only store JSON-safe response data. Never store raw BigInt values.
    const responseBody = JSON.parse(
      JSON.stringify(result.body ?? {})
    );

    await tx.idempotencyKey.update({
      where: { id: record.id },
      data: {
        status: result.failed ? 'FAILED' : 'COMPLETED',
        responseStatus: result.statusCode,
        responseBody,
        lockedAt: null,
      },
    });

    return {
      replayed: false,
      statusCode: result.statusCode,
      body: responseBody,
    };
  }, {
    maxWait: 10_000,
    timeout: 15_000,
  });
}
