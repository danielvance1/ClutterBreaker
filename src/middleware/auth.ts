import type { NextFunction, Request, Response } from 'express';
import { hashToken } from '../lib/token.js';
import { pool } from '../db.js';
import { findUserByActiveSession } from '../repos/sessions.js';
import type { User } from '../repos/users.js';

export const SESSION_COOKIE = 'session';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Never rejects a request itself; requireAuth and requireParent do that.
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && token !== '') {
    const user = await findUserByActiveSession(pool, hashToken(token));
    if (user) req.user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }
  next();
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }
  if (req.user.role !== 'parent') {
    res.status(403).json({ error: 'Parents only' });
    return;
  }
  next();
}
