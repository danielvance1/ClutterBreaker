import type { Db } from './db.js';
import { toUser, type User, type UserRow } from './users.js';

export async function createSession(
  db: Db,
  input: { userId: number; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [input.userId, input.tokenHash, input.expiresAt],
  );
}

export async function findUserByActiveSession(db: Db, tokenHash: string): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT u.id, u.family_id, u.role, u.display_name, u.email, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}
