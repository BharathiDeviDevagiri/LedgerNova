import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashRequestBody } from '../src/services/idempotency.service.js';

describe('Idempotency Service & Payload Verification', () => {
  it('computes identical SHA-256 hashes regardless of JSON object key ordering', () => {
    const payload1 = {
      accountId: 'acc-1234',
      amount: '500.00',
      description: 'Monthly Rent',
    };

    const payload2 = {
      description: 'Monthly Rent',
      amount: '500.00',
      accountId: 'acc-1234',
    };

    const hash1 = hashRequestBody(payload1);
    const hash2 = hashRequestBody(payload2);

    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
  });

  it('produces different hashes when payload values change', () => {
    const payload1 = { accountId: 'acc-1234', amount: '500.00' };
    const payload2 = { accountId: 'acc-1234', amount: '500.01' };

    assert.notEqual(hashRequestBody(payload1), hashRequestBody(payload2));
  });

  it('handles null, empty, and nested payloads deterministically', () => {
    assert.equal(typeof hashRequestBody({}), 'string');
    assert.equal(typeof hashRequestBody(null), 'string');
    assert.equal(
      hashRequestBody({ a: { b: 1, c: 2 } }),
      hashRequestBody({ a: { c: 2, b: 1 } })
    );
  });
});
