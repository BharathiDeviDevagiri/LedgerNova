import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseRupeesToPaise,
  formatPaiseToRupees,
} from './money.js';

describe('Money utility', () => {
  it('converts whole rupees into paise', () => {
    assert.equal(parseRupeesToPaise('100').toString(), '10000');
  });

  it('converts decimal rupees into paise', () => {
    assert.equal(parseRupeesToPaise('100.50').toString(), '10050');
  });

  it('supports one paisa', () => {
    assert.equal(parseRupeesToPaise('0.01').toString(), '1');
  });

  it('formats paise into rupees', () => {
    assert.equal(formatPaiseToRupees(10050n), '100.50');
  });

  it('rejects zero and negative amounts', () => {
    assert.throws(() => parseRupeesToPaise('0'));
    assert.throws(() => parseRupeesToPaise('-10'));
  });

  it('rejects more than two decimal places', () => {
    assert.throws(() => parseRupeesToPaise('10.999'));
  });

  it('rejects scientific notation and invalid strings', () => {
    assert.throws(() => parseRupeesToPaise('1e3'));
    assert.throws(() => parseRupeesToPaise('abc'));
  });

  it('rejects JavaScript numbers instead of decimal strings', () => {
    assert.throws(() => parseRupeesToPaise(100.50));
  });
});
