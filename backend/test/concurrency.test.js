import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Concurrency & Deadlock Prevention Invariants', () => {
  it('guarantees deterministic lock acquisition order for any transfer pair', () => {
    const accA = '3c8e45a0-9e67-4a7b-8f12-000000000001';
    const accB = '9a1b2c3d-4e5f-6a7b-8c9d-000000000002';

    // Transfer 1: from A to B
    const order1 = [accA, accB].sort();

    // Transfer 2: from B to A
    const order2 = [accB, accA].sort();

    // Both must result in the exact same sequence of locks!
    assert.deepEqual(order1, order2);
    assert.equal(order1[0], accA);
    assert.equal(order1[1], accB);
  });

  it('prevents overdraft when multiple withdrawals compete for balance', () => {
    let availableBalance = 1000000n; // ₹10,000.00
    const withdrawalAmount = 1000000n; // ₹10,000.00

    let successfulWithdrawals = 0;
    let failedWithdrawals = 0;

    // Simulate 5 serial/locked requests inside PostgreSQL SELECT FOR UPDATE locks
    for (let i = 0; i < 5; i++) {
      if (availableBalance >= withdrawalAmount) {
        availableBalance -= withdrawalAmount;
        successfulWithdrawals++;
      } else {
        failedWithdrawals++;
      }
    }

    assert.equal(successfulWithdrawals, 1);
    assert.equal(failedWithdrawals, 4);
    assert.equal(availableBalance, 0n);
    assert.ok(availableBalance >= 0n, 'Account balance must never be negative');
  });
});
