import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './authRateLimit.js';

function makeResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('Authentication rate limiter', () => {
  it('allows requests up to the configured limit and rejects the next one', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: 'Too many requests.',
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = makeResponse();
      let continued = false;
      limiter({ ip: '192.0.2.1' }, response, () => {
        continued = true;
      });
      assert.equal(continued, true);
    }

    const blockedResponse = makeResponse();
    let continued = false;
    limiter({ ip: '192.0.2.1' }, blockedResponse, () => {
      continued = true;
    });

    assert.equal(continued, false);
    assert.equal(blockedResponse.statusCode, 429);
    assert.equal(blockedResponse.body.error, 'Too many requests.');
    assert.ok(Number(blockedResponse.headers['Retry-After']) > 0);
  });

  it('tracks separate client addresses independently', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      message: 'Too many requests.',
    });
    const first = makeResponse();
    const second = makeResponse();

    limiter({ ip: '192.0.2.2' }, first, () => {});
    limiter({ ip: '192.0.2.3' }, second, () => {});

    assert.equal(first.statusCode, null);
    assert.equal(second.statusCode, null);
  });
});
