import { beforeAll, describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { validTckn, calculateNet, registerSchema } from '@/lib/validation';
import { encryptIdentity, decryptIdentity, blindIndex, hashToken } from '@/lib/security/crypto';
import { requireSameOrigin, boundedBody } from '@/lib/security/request';
import { sealSessionToken, unsealSessionToken } from '@/lib/auth/cookie';
import { dateTimeToUtc, weekDay } from '@/lib/time';
beforeAll(() => {
  for (const name of ['AUTH_SECRET', 'TCKN_ENCRYPTION_KEY', 'TCKN_HMAC_KEY'])
    process.env[name] = randomBytes(32).toString('hex');
  process.env.APP_URL = 'https://akademi.example.test';
});
function syntheticTckn() {
  const n = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  n.push(((((n[0] + n[2] + n[4] + n[6] + n[8]) * 7 - (n[1] + n[3] + n[5] + n[7])) % 10) + 10) % 10);
  n.push(n.reduce((a, b) => a + b, 0) % 10);
  return n.join('');
}
describe('Kimlik ve akademik doğrulama', () => {
  it('checks both TCKN digits and length; never claims person verification', () => {
    const tc = syntheticTckn();
    expect(validTckn(tc)).toBe(true);
    expect(validTckn('0' + tc.slice(1))).toBe(false);
    expect(validTckn(tc.slice(0, 10))).toBe(false);
    expect(validTckn(tc.slice(0, 10) + ((Number(tc[10]) + 1) % 10))).toBe(false);
  });
  it('rejects weak registration, missing acknowledgement, and mismatched passwords', () => {
    const base = {
      firstName: 'Sentetik',
      lastName: 'Test',
      email: 'test@example.test',
      tckn: syntheticTckn(),
      password: 'abcdefghijkl',
      confirmPassword: 'abcdefghijkl',
      privacy: true,
    };
    expect(registerSchema.safeParse(base).success).toBe(true);
    for (const change of [
      { password: 'short' },
      { privacy: false },
      { confirmPassword: 'different' },
    ])
      expect(registerSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });
  it('calculates quarter nets including negative results', () => {
    expect(calculateNet(30, 7, 3, 40)).toBe(28.25);
    expect(calculateNet(0, 20, 0, 20)).toBe(-5);
    expect(calculateNet(40, 0, 0, 40)).toBe(40);
  });
  it('rejects counts beyond template, fractions and negative answers', () => {
    for (const v of [
      [40, 1, 0, 40],
      [-1, 0, 0, 40],
      [1.5, 1, 0, 40],
      [0, 0, 0, 0],
    ])
      expect(() => calculateNet(...(v as [number, number, number, number]))).toThrow();
  });
});
describe('Encryption, sessions, CSRF and bounded requests', () => {
  it('uses randomized authenticated encryption and deterministic keyed blind indexes', () => {
    const value = 'synthetic-identity-only',
      a = encryptIdentity(value),
      b = encryptIdentity(value);
    expect(a).not.toBe(b);
    expect(a).not.toContain(value);
    expect(decryptIdentity(a)).toBe(value);
    expect(blindIndex(value)).toBe(blindIndex(value));
    expect(blindIndex(value)).not.toBe(hashToken(value));
    const parts = a.split('.');
    parts[2] = Buffer.alloc(16).toString('base64url');
    expect(() => decryptIdentity(parts.join('.'))).toThrow();
  });
  it('invalidates HMAC matching under another key', () => {
    const old = process.env.TCKN_HMAC_KEY,
      index = blindIndex('x');
    process.env.TCKN_HMAC_KEY = randomBytes(32).toString('hex');
    expect(blindIndex('x')).not.toBe(index);
    process.env.TCKN_HMAC_KEY = old;
  });
  it('seals opaque session tokens and rejects modified cookies', async () => {
    const token = randomBytes(32).toString('base64url'),
      cookie = await sealSessionToken(token, 86400);
    expect(cookie).not.toContain(token);
    expect(await unsealSessionToken(cookie)).toBe(token);
    expect(await unsealSessionToken(cookie.slice(0, -10) + 'tampered00')).toBeUndefined();
    expect(await unsealSessionToken(undefined)).toBeUndefined();
  });
  it('rejects missing or hostile origins', () => {
    expect(() => requireSameOrigin(null)).toThrow();
    expect(() => requireSameOrigin('https://attacker.test')).toThrow();
    expect(() => requireSameOrigin('https://akademi.example.test.attacker.test')).toThrow();
    expect(() => requireSameOrigin('https://akademi.example.test')).not.toThrow();
  });
  it('enforces body limits even without content-length', async () => {
    await expect(
      boundedBody(new Request('http://localhost', { method: 'POST', body: '1234567890' }), 5),
    ).rejects.toMatchObject({ status: 413 });
    expect(
      new TextDecoder().decode(
        await boundedBody(new Request('http://localhost', { method: 'POST', body: '123' }), 5),
      ),
    ).toBe('123');
  });
  it('converts Turkish local due dates into UTC and supports Sundays', () => {
    expect(dateTimeToUtc('2026-10-26T12:00')).toBe('2026-10-26T09:00:00.000Z');
    expect(weekDay('2026-10-25')).toBe(6);
    expect(weekDay('2026-10-26')).toBe(0);
  });
});
