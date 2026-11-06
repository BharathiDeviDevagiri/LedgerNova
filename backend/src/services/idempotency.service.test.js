import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hashRequestBody } from './idempotency.service.js';

describe('Idempotency request hashing', () => {
  it('produces the same hash when object key order changes', () => {
    const first = { amount: '100.50', accountId: 'A1' };
    const second = { accountId: 'A1', amount: '100.50' };

    assert.equal(hashRequestBody(first), hashRequestBody(second));
  });

  it('produces different hashes for different amounts', () => {
    assert.notEqual(
      hashRequestBody({ amount: '100.00' }),
      hashRequestBody({ amount: '200.00' })
    );
  });

  it('produces different hashes for different account IDs', () => {
    assert.notEqual(
      hashRequestBody({ accountId: 'A1' }),
      hashRequestBody({ accountId: 'A2' })
    );
  });

  it('handles an empty request body', () => {
    assert.equal(
      hashRequestBody({}),
      hashRequestBody(undefined)
    );
  });
});
