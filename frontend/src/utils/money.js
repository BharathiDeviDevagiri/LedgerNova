const MAX_BIGINT = 9223372036854775807n;
const RUPEE_AMOUNT_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export function parseRupeesToPaise(value) {
  if (typeof value !== 'string' || !RUPEE_AMOUNT_PATTERN.test(value)) {
    throw new TypeError('Enter a rupee amount with at most two decimal places.');
  }

  const [rupees, fraction = ''] = value.split('.');
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0') || '0');

  if (paise <= 0n || paise > MAX_BIGINT) {
    throw new RangeError('Amount is outside the supported range.');
  }

  return paise;
}

export function formatPaiseToRupees(value) {
  const paise = typeof value === 'bigint' ? value : BigInt(value);
  const sign = paise < 0n ? '-' : '';
  const absolute = paise < 0n ? -paise : paise;

  return `${sign}${absolute / 100n}.${(absolute % 100n)
    .toString()
    .padStart(2, '0')}`;
}

export function formatPaiseForDisplay(value) {
  const formatted = formatPaiseToRupees(value);
  const [rupees, paise] = formatted.split('.');
  return `${BigInt(rupees).toLocaleString('en-IN')}.${paise}`;
}
