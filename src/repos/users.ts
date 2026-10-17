import type { Db } from './db.js';

export type User = {
  id: number;
  familyId: number;
  role: 'parent' | 'kid';
  displayName: string;
  email: string | null;
  createdAt: Date;
};

type UserRow = {
  id: number;
  family_id: number;
  role: 'parent' | 'kid';
  display_name: string;
  email: string | null;
  created_at: Date;
};

// Hashes are never selected here; only findParentWithHashByEmail reads one.
function toUser(row: UserRow): User {
  return {
    id: row.id,
    familyId: row.family_id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export async function createParent(
  db: Db,
  input: { familyId: number; displayName: string; email: string; passwordHash: string },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (family_id, role, display_name, email, password_hash)
     VALUES ($1, 'parent', $2, $3, $4)
     RETURNING id, family_id, role, display_name, email, created_at`,
    [input.familyId, input.displayName, input.email, input.passwordHash],
  );
  return toUser(rows[0]);
}

export async function createKid(
  db: Db,
  input: { familyId: number; displayName: string; pinHash: string },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (family_id, role, display_name, pin_hash)
     VALUES ($1, 'kid', $2, $3)
     RETURNING id, family_id, role, display_name, email, created_at`,
    [input.familyId, input.displayName, input.pinHash],
  );
  return toUser(rows[0]);
}

export async function findUserById(db: Db, id: number): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, family_id, role, display_name, email, created_at
     FROM users
     WHERE id = $1`,
    [id],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findParentWithHashByEmail(
  db: Db,
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  // lower() on both sides matches the unique index on lower(email).
  const { rows } = await db.query<UserRow & { password_hash: string }>(
    `SELECT id, family_id, role, display_name, email, created_at, password_hash
     FROM users
     WHERE lower(email) = lower($1) AND role = 'parent'`,
    [email],
  );
  return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}
