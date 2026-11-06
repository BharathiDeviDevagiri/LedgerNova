import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Authentication & Security Invariants', () => {
  const TEST_SECRET = 'a_very_secure_test_jwt_secret_of_at_least_32_characters!';

  it('hashes passwords securely using bcrypt', async () => {
    const rawPassword = 'SuperSecretPassword@2026';
    const hash = await bcrypt.hash(rawPassword, 10);

    assert.notEqual(hash, rawPassword);
    assert.equal(await bcrypt.compare(rawPassword, hash), true);
    assert.equal(await bcrypt.compare('WrongPassword', hash), false);
  });

  it('generates verifiable JWT tokens with expiration', () => {
    const payload = { userId: 'user-uuid-1234' };
    const token = jwt.sign(payload, TEST_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    const decoded = jwt.verify(token, TEST_SECRET);
    assert.equal(decoded.userId, 'user-uuid-1234');
    assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
  });

  it('rejects tampered or forged JWT tokens', () => {
    const validToken = jwt.sign({ userId: 'user-1' }, TEST_SECRET);
    const wrongSecret = 'another_totally_different_secret_key_32_chars!';

    assert.throws(() => jwt.verify(validToken, wrongSecret));
  });
});
