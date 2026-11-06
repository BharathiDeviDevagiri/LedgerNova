import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPaiseToRupees, parseRupeesToPaise } from './money.js';

describe('Frontend paise conversion', () => {
  it('converts decimal strings to paise without floating-point arithmetic', () => {
    assert.equal(parseRupeesToPaise('90071992547409.93'), 9007199254740993n);
    assert.equal(parseRupeesToPaise('0.01'), 1n);
  });

  it('rejects invalid precision, zero, negative and out-of-range amounts', () => {
    for (const amount of ['1.001', '-1.00', '0', '01.00', '92233720368547758.08']) {
      assert.throws(() => parseRupeesToPaise(amount));
    }
  });

  it('formats integer paise as a decimal rupee string', () => {
    assert.equal(formatPaiseToRupees(9007199254740993n), '90071992547409.93');
    assert.equal(formatPaiseToRupees(1n), '0.01');
  });
});
