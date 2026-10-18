// import type { Db } from './db.js';
// import { toUser, type User, type UserRow } from './users.js';

// export async function createSession(
//   db: Db,
//   input: { userId: number; tokenHash: string; expiresAt: Date },
// ): Promise<void> {
//   await db.query(
//     `INSERT INTO sessions (user_id, token_hash, expires_at)
//      VALUES ($1, $2, $3)`,
//     [input.userId, input.tokenHash, input.expiresAt],
//   );
// }

// CREATE TABLE parent_invites (
//   id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
//   family_id integer NOT NULL REFERENCES families (id) ON DELETE CASCADE,
//   invited_by integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
//   email text NOT NULL,
//   token_hash text NOT NULL UNIQUE,
//   created_at timestamptz NOT NULL DEFAULT now(),
//   expires_at timestamptz NOT NULL,
//   used_at timestamptz, -- NULL means not used yet.
// );

import { Db } from './db.js';
import { withTransaction } from '../db.js';
import { PoolClient } from 'pg';

export async function createInvite(
  db: Db,
  input: { 
    familyId: number; 
    invitedBy: number;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }
): Promise<void> {
  await db.query(
      `INSERT INTO parent_invites (family_id, invited_by, email, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.familyId, 
        input.invitedBy, 
        input.email, 
        input.tokenHash,
        input.expiresAt
      ]
  );
}

export async function claimInvite(
  db: Db,
  input: {
    tokenHash: string; 
    email: string;
  }
): Promise<{familyId: number} | null> {
  return await withTransaction<{ familyId: number }>(
    (client: PoolClient): Promise<{ familyId: number }> => {
      return await (async () => return { familyId: 4 });
    }
  });
  
  const { rows } = await db.query(
    `SELECT family_id FROM parent_invites
     WHERE token_hash = $1 AND email = $2`,
    [input.tokenHash, input.email]
  );

  if(rows.length == 0){
    return null;
  }
  else {
    return { familyId: rows[0] };
  }
}

// export async function findUserByActiveSession(db: Db, tokenHash: string): Promise<User | null> {
//   const { rows } = await db.query<UserRow>(
//     `SELECT u.id, u.family_id, u.role, u.display_name, u.email, u.created_at
//      FROM sessions s
//      JOIN users u ON u.id = s.user_id
//      WHERE s.token_hash = $1 AND s.expires_at > now()`,
//     [tokenHash],
//   );
//   return rows[0] ? toUser(rows[0]) : null;
// }

// export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
//   await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
// }
