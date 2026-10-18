import { Db } from './db.js';

export async function createInvite(
  db: Db,
  input: { 
    familyId: number; 
    invitedBy: number;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }
): Promise<{ inviteId: number, email: string } | null> {
  const { rows: [firstRow] } = await db.query<{ invite_id: number, email: string }>(
    `INSERT INTO parent_invites (family_id, invited_by, email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING (id, email)`,
    [
      input.familyId, 
      input.invitedBy, 
      input.email.toLowerCase(), 
      input.tokenHash,
      input.expiresAt
    ]
  );

  return firstRow ? { inviteId: firstRow.invite_id, email: firstRow.email } : null;
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
