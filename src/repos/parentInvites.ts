import { Db } from './db.js';
import { findUserById } from './users.js';

export async function createInvite(
  db: Db,
  input: { 
    invitedBy: number;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }
): Promise<{ id: number, email: string } | null> {
  const { rows: [firstRow] } = await db.query<{ id: number, email: string }>(
    `INSERT INTO parent_invites (family_id, invited_by, email, token_hash, expires_at)
     SELECT family_id, id, lower($2::text), $3::text, $4::timestamptz
     FROM users
     WHERE id = $1 AND role = 'parent'
     RETURNING id, email`,
    [
      input.invitedBy, 
      input.email, 
      input.tokenHash,
      input.expiresAt
    ]
  );

  return firstRow ? { id: firstRow.id, email: firstRow.email } : null;
}

export async function claimInvite(
  db: Db,
  input: {
    tokenHash: string; 
    email: string;
  }
): Promise<{ familyId: number } | null> {
  const { rows: [firstRow] } = await db.query<{ family_id: number }>(
    `UPDATE parent_invites
     SET used_at = NOW()
     WHERE token_hash = $1 AND 
           email = lower($2) AND 
           used_at IS NULL AND 
           expires_at > NOW()
     RETURNING family_id`,
    [input.tokenHash, input.email]
  );

  return firstRow ? { familyId: firstRow.family_id } : null;
}
