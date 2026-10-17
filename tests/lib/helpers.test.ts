import { describe, expect, it } from 'vitest';
import { generateJoinCode } from '../../src/lib/joinCode.js';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';
import { generateSessionToken, hashToken } from '../../src/lib/token.js';

describe('passwords', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct-horse')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});

describe('tokens', () => {
  it('generates distinct base64url tokens of 32 bytes', () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(a);
  });

  it('hashToken is a stable SHA-256 hex digest', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('generateJoinCode', () => {
  it('makes 8 characters without look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateJoinCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});
