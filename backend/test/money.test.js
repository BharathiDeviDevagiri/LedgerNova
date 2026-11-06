import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRupeesToPaise, formatPaiseToRupees } from '../src/utils/money.js';

describe('Financial Math & Paise Representation', () => {
  it('converts whole rupee string to integer paise', () => {
    assert.equal(parseRupeesToPaise('100'), 10000n);
    assert.equal(parseRupeesToPaise('1'), 100n);
    assert.equal(parseRupeesToPaise('50000'), 5000000n);
  });

  it('converts decimal rupee string to exact integer paise without float inaccuracies', () => {
    assert.equal(parseRupeesToPaise('100.50'), 10050n);
    assert.equal(parseRupeesToPaise('0.01'), 1n);
    assert.equal(parseRupeesToPaise('0.99'), 99n);
    assert.equal(parseRupeesToPaise('1234.56'), 123456n);
  });

  it('rejects invalid, negative, or zero amounts', () => {
    assert.throws(() => parseRupeesToPaise('0'), /greater than zero/);
    assert.throws(() => parseRupeesToPaise('-50'), /positive rupee amount/);
    assert.throws(() => parseRupeesToPaise('abc'), /positive rupee amount/);
    assert.throws(() => parseRupeesToPaise('10.999'), /at most two decimal places/);
    assert.throws(() => parseRupeesToPaise(100), /decimal string/);
  });

  it('formats integer paise back to INR string correctly', () => {
    assert.equal(formatPaiseToRupees(10050n), '100.50');
    assert.equal(formatPaiseToRupees(1n), '0.01');
    assert.equal(formatPaiseToRupees(100n), '1.00');
    assert.equal(formatPaiseToRupees(0n), '0.00');
    assert.equal(formatPaiseToRupees(-500n), '-5.00');
  });

  it('prevents JavaScript floating-point rounding errors', () => {
    // In IEEE 754 float: 0.1 + 0.2 = 0.30000000000000004
    // In LedgerLine integer paise:
    const tenPaise = parseRupeesToPaise('0.10');
    const twentyPaise = parseRupeesToPaise('0.20');
    const thirtyPaise = parseRupeesToPaise('0.30');

    assert.equal(tenPaise + twentyPaise, thirtyPaise);
    assert.equal(tenPaise + twentyPaise, 30n);
  });
});
