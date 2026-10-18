import { Router, type Response } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { generateJoinCode as defaultGenerateJoinCode } from '../lib/joinCode.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { generateSessionToken, hashToken } from '../lib/token.js';
import { SESSION_COOKIE, requireAuth } from '../middleware/auth.js';
import type { Db } from '../repos/db.js';
import { createFamily, type Family } from '../repos/families.js';
import { createSession, deleteSession } from '../repos/sessions.js';
import { createParent, findParentWithHashByEmail } from '../repos/users.js';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const JOIN_CODE_ATTEMPTS = 5;

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(1).max(50),
  familyName: z.string().trim().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(128),
});

// Verified against when the email is unknown, so both failures take similar time.
const dummyHash = hashPassword('not-a-real-password');

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };
}

// Returns the raw token; the caller sets the cookie once any surrounding transaction commits.
async function createSessionToken(db: Db, userId: number): Promise<string> {
  const token = generateSessionToken();
  await createSession(db, {
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
  });
  return token;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_LIFETIME_MS });
}

function constraintOf(err: unknown): string | undefined {
  const e = err as { code?: string; constraint?: string };
  return e?.code === '23505' ? e.constraint : undefined;
}

// Retries only when the generated code collided; any other error propagates.
async function createFamilyWithJoinCode(
  db: Db,
  name: string,
  generateJoinCode: () => string,
): Promise<Family> {
  for (let attempt = 1; ; attempt++) {
    // A savepoint keeps the transaction usable after a failed insert.
    await db.query('SAVEPOINT join_code');
    try {
      const family = await createFamily(db, { name, joinCode: generateJoinCode() });
      await db.query('RELEASE SAVEPOINT join_code');
      return family;
    } catch (err) {
      if (constraintOf(err) !== 'families_join_code_key' || attempt >= JOIN_CODE_ATTEMPTS) {
        throw err;
      }
      await db.query('ROLLBACK TO SAVEPOINT join_code');
    }
  }
}

export function createAuthRouter(
  options: { generateJoinCode?: () => string } = {},
): Router {
  const generateJoinCode = options.generateJoinCode ?? defaultGenerateJoinCode;
  const router = Router();

  router.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid signup details' });
      return;
    }
    const { email, password, displayName, familyName } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const result = await withTransaction(async (client) => {
        const family = await createFamilyWithJoinCode(client, familyName, generateJoinCode);
        const user = await createParent(client, {
          familyId: family.id,
          displayName,
          email,
          passwordHash,
        });
        const token = await createSessionToken(client, user.id);
        return { user, family, token };
      });
      setSessionCookie(res, result.token);
      res.status(201).json({
        user: result.user,
        family: { id: result.family.id, name: result.family.name, joinCode: result.family.joinCode },
      });
    } catch (err) {
      if (constraintOf(err) === 'users_email_lower_key') {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
      throw err;
    }
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid login details' });
      return;
    }
    const { email, password } = parsed.data;
    const found = await findParentWithHashByEmail(pool, email);
    const ok = await verifyPassword(found ? found.passwordHash : await dummyHash, password);
    if (!found || !ok) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    setSessionCookie(res, await createSessionToken(pool, found.id));
    const { passwordHash: _omit, ...user } = found;
    res.status(200).json({ user });
  });

  router.post('/logout', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token !== '') {
      await deleteSession(pool, hashToken(token));
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.status(200).json({ user: req.user });
  });

  return router;
}
