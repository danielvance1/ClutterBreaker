import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db.js';
import { hashToken } from '../../src/lib/token.js';
import { createAuthRouter } from '../../src/routes/auth.js';
import { createSession } from '../../src/repos/sessions.js';
import { app } from '../../src/app.js';
import { resetDb } from '../helpers/db.js';

const valid = {
  email: 'mom@example.com',
  password: 'correct-horse-battery',
  displayName: 'Mom',
  familyName: 'Vance',
};

async function count(table: string): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

function sessionCookie(res: request.Response): string {
  const header = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
    c.startsWith('session='),
  )!;
  return header.split(';')[0];
}

beforeEach(resetDb);

describe('POST /auth/signup', () => {
  it('creates a family, a parent, and a session cookie', async () => {
    const res = await request(app).post('/auth/signup').send(valid).expect(201);
    expect(res.body.user).toMatchObject({ role: 'parent', email: valid.email });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);
    expect(res.body.family).toMatchObject({ name: 'Vance' });
    expect(res.body.family.joinCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(await count('families')).toBe(1);
    expect(await count('users')).toBe(1);
    expect(await count('sessions')).toBe(1);

    const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('stores only the token hash and an argon2id password hash', async () => {
    const res = await request(app).post('/auth/signup').send(valid).expect(201);
    const raw = sessionCookie(res).slice('session='.length);
    const { rows } = await pool.query('SELECT token_hash FROM sessions');
    expect(rows[0].token_hash).toBe(hashToken(raw));
    expect(rows[0].token_hash).not.toBe(raw);
    const users = await pool.query('SELECT password_hash FROM users');
    expect(users.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  it('returns 409 for a duplicate email in any letter case and leaves no extra family', async () => {
    await request(app).post('/auth/signup').send(valid).expect(201);
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...valid, email: 'MOM@Example.com' })
      .expect(409);
    expect(res.body).toEqual({ error: 'Email already in use' });
    expect(await count('families')).toBe(1);
  });

  it.each([
    ['bad email', { email: 'nope' }],
    ['short password', { password: 'short' }],
    ['empty family name', { familyName: '   ' }],
  ])('returns 400 and writes nothing for %s', async (_name, override) => {
    await request(app)
      .post('/auth/signup')
      .send({ ...valid, ...override })
      .expect(400);
    expect(await count('families')).toBe(0);
    expect(await count('users')).toBe(0);
  });

  it('ignores role and familyId in the body', async () => {
    await request(app).post('/auth/signup').send(valid).expect(201);
    const res = await request(app)
      .post('/auth/signup')
      .send({ ...valid, email: 'dad@example.com', role: 'kid', familyId: 1 })
      .expect(201);
    expect(res.body.user.role).toBe('parent');
    expect(res.body.user.familyId).not.toBe(1);
    expect(await count('families')).toBe(2);
  });

  it('retries a join code collision', async () => {
    await request(app).post('/auth/signup').send(valid).expect(201);
    const { rows } = await pool.query('SELECT join_code FROM families');
    const taken = rows[0].join_code as string;
    const codes = [taken, taken, 'FRESHONE'];
    const testApp = express();
    testApp.use(express.json());
    testApp.use(createAuthRouter({ generateJoinCode: () => codes.shift()! }));

    const res = await request(testApp)
      .post('/signup')
      .send({ ...valid, email: 'dad@example.com' })
      .expect(201);
    expect(res.body.family.joinCode).toBe('FRESHONE');
    expect(await count('families')).toBe(2);
  });
});

describe('login, me, logout', () => {
  beforeEach(async () => {
    await request(app).post('/auth/signup').send(valid).expect(201);
    await pool.query('DELETE FROM sessions');
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'MOM@example.com', password: valid.password })
      .expect(200);
    expect(res.body.user.email).toBe(valid.email);
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);
    expect(sessionCookie(res)).toMatch(/^session=/);
  });

  it('gives identical 401s for a wrong password and an unknown email', async () => {
    const wrong = await request(app)
      .post('/auth/login')
      .send({ email: valid.email, password: 'wrong-password' })
      .expect(401);
    const unknown = await request(app)
      .post('/auth/login')
      .send({ email: 'who@example.com', password: 'wrong-password' })
      .expect(401);
    expect(wrong.body).toEqual({ error: 'Invalid email or password' });
    expect(unknown.body).toEqual(wrong.body);
  });

  it('logout deletes the session, clears the cookie, and /me then returns 401', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: valid.email, password: valid.password });
    const cookie = sessionCookie(login);
    await request(app).get('/auth/me').set('Cookie', cookie).expect(200);

    const out = await request(app).post('/auth/logout').set('Cookie', cookie).expect(204);
    expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^session=;/);
    expect(await count('sessions')).toBe(0);
    await request(app).get('/auth/me').set('Cookie', cookie).expect(401);
  });

  it('logout returns 204 with no session', async () => {
    await request(app).post('/auth/logout').expect(204);
  });

  it('/me returns 401 with no cookie, a garbage cookie, or an expired session', async () => {
    await request(app).get('/auth/me').expect(401);
    await request(app).get('/auth/me').set('Cookie', 'session=garbage').expect(401);
    const { rows } = await pool.query('SELECT id FROM users');
    await createSession(pool, {
      userId: rows[0].id,
      tokenHash: hashToken('expired'),
      expiresAt: new Date(Date.now() - 1000),
    });
    await request(app).get('/auth/me').set('Cookie', 'session=expired').expect(401);
  });
});
