import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db.js';
import { hashToken } from '../../src/lib/token.js';
import { attachUser, requireAuth, requireParent } from '../../src/middleware/auth.js';
import { createFamily } from '../../src/repos/families.js';
import { createSession } from '../../src/repos/sessions.js';
import { createKid, createParent } from '../../src/repos/users.js';
import { resetDb } from '../helpers/db.js';

const app = express();
app.use(cookieParser());
app.use(attachUser);
app.get('/any', requireAuth, (_req, res) => res.json({ ok: true }));
app.get('/parent', requireParent, (_req, res) => res.json({ ok: true }));

async function sessionFor(userId: number, token: string) {
  await createSession(pool, {
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
}

let parentId: number;
let kidId: number;

beforeEach(async () => {
  await resetDb();
  const family = await createFamily(pool, { name: 'Smiths', joinCode: 'ABCDEFGH' });
  parentId = (
    await createParent(pool, {
      familyId: family.id,
      displayName: 'Mom',
      email: 'mom@example.com',
      passwordHash: 'x',
    })
  ).id;
  kidId = (await createKid(pool, { familyId: family.id, displayName: 'Sam', pinHash: 'x' })).id;
});

describe('auth middleware', () => {
  it('requireAuth returns 401 without a session and a garbage cookie', async () => {
    await request(app).get('/any').expect(401);
    await request(app).get('/any').set('Cookie', 'session=garbage').expect(401);
  });

  it('requireAuth lets a kid through', async () => {
    await sessionFor(kidId, 'kid-token');
    await request(app).get('/any').set('Cookie', 'session=kid-token').expect(200);
  });

  it('requireParent returns 401 without a session', async () => {
    await request(app).get('/parent').expect(401);
  });

  it('requireParent returns 403 for a kid and lets a parent through', async () => {
    await sessionFor(kidId, 'kid-token');
    await sessionFor(parentId, 'parent-token');
    await request(app).get('/parent').set('Cookie', 'session=kid-token').expect(403);
    await request(app).get('/parent').set('Cookie', 'session=parent-token').expect(200);
  });
});
