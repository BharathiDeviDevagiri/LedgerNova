const MAX_BIGINT = 9223372036854775807n;

/**
 * Convert a rupee amount supplied as a decimal string into integer paise.
 * Examples: "100" -> 10000n, "100.50" -> 10050n.
 *
 * Never use floating-point arithmetic for financial amounts.
 */
export function parseRupeesToPaise(value) {
  if (typeof value !== 'string') {
    throw Object.assign(
      new Error('Amount must be provided as a decimal string.'),
      { statusCode: 400 }
    );
  }

  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw Object.assign(
      new Error('Invalid amount. Use a positive rupee amount with at most two decimal places.'),
      { statusCode: 400 }
    );
  }

  const [rupees, fraction = ''] = value.split('.');
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, '0') || '0');

  if (paise <= 0n) {
    throw Object.assign(
      new Error('Amount must be greater than zero.'),
      { statusCode: 400 }
    );
  }

  if (paise > MAX_BIGINT) {
    throw Object.assign(
      new Error('Amount exceeds the supported financial limit.'),
      { statusCode: 400 }
    );
  }

  return paise;
}

/**
 * Convert integer paise into a rupee decimal string.
 * Examples: 10050n -> "100.50", 1n -> "0.01".
 */
export function formatPaiseToRupees(value) {
  let paise;

  try {
    paise = typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    throw new TypeError('Invalid paise value.');
  }

  const negative = paise < 0n;
  const absolute = negative ? -paise : paise;

  const rupees = absolute / 100n;
  const remainingPaise = (absolute % 100n).toString().padStart(2, '0');

  return `${negative ? '-' : ''}${rupees}.${remainingPaise}`;
}
