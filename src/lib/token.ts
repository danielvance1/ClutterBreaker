import { createHash, randomBytes } from 'node:crypto';

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

// The database only ever sees this hash, never the cookie value.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
