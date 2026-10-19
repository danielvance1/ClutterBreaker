import { beforeEach, describe, it, expect } from 'vitest';
import { pool } from '../../src/db.js';
import { resetDb } from '../helpers/db.js';
import { createInvite, claimInvite } from '../../src/repos/parentInvites.js';
import { createFamily } from '../../src/repos/families.js';
import { createParent } from '../../src/repos/users.js';
import { hashToken } from '../../src/lib/token.js';

const familyDetails = {
  name: 'Vance',
  joinCode: 'ABCD1234'
};

const parentDetails = { 
  familyId: 1, 
  displayName: 'Mom', 
  email: 'mom@gmail.com', 
  passwordHash: 'password-hash'
};

const future = (): Date => { return new Date(Date.now() + 60_000) };

const dadInviteDetails = (): any => { 
  return {
    email: 'DAD@gmail.com', 
    tokenHash: 'token-hash',
    expiresAt: future()
  };
}

beforeEach(resetDb);

describe('create invite', () => {
  it('create invite returns invite and lowercased email, not tokenHash', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});
    const invite = await createInvite(pool, { familyId: family.id, invitedBy: parent.id, ...dadInviteDetails() });
    expect(invite).toMatchObject({ inviteId: 1, email: 'dad@gmail.com'});
    expect(invite).not.toHaveProperty('tokenHash');
  });

  it('when family does not exist, invite is not created', async () => {
    const parent = await createParent(pool, {...parentDetails});
    const invite = await createInvite(pool, { familyId: 1, invitedBy: parent.id, ...dadInviteDetails() });
    expect(invite).toBeNull();
  });

  it('when invite initiator does not exist, invite is not created', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const invite = await createInvite(pool, { familyId: family.id, invitedBy: 1, ...dadInviteDetails() });
    expect(invite).toBeNull();
  });
});

describe('claim invite', () => {
  it('claiming an invite succeeds and sets the used_at column', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});

    await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: 'DAD@gmail.com', tokenHash: 'token-hash', expiresAt: future() });
    const inviteClaimResult = await claimInvite(pool, {tokenHash: 'token-hash', email: 'Dad@gmail.com'});

    expect(inviteClaimResult).not.toBeNull();
    expect(inviteClaimResult?.familyId).toEqual(1);

    const { rows: [ { used_at: usedAt } ] } = await pool.query<{ used_at: Date }>(
      `SELECT used_at FROM parent_invites
       WHERE family_id = $1`,
      [family.id]
    );

    expect(usedAt).not.toBeNull();
    expect(usedAt).toBeTypeOf(typeof(Date));
  });

  it('invite cannot be claimed twice', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});
    
    await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: 'DAD@gmail.com', tokenHash: 'token-hash', expiresAt: future() });
    await claimInvite(pool, {tokenHash: 'token-hash', email: 'Dad@gmail.com'});
    const secondClaimAttempt = await claimInvite(pool, {tokenHash: 'token-hash', email: 'Dad@gmail.com'});

    expect(secondClaimAttempt).toBeNull();
  });

  it.each([
    { name: "wrong token hash", tokenHash: "token-hash-wrong", email: "Dad@gmail.com", expiresAt: future() },
    { name: "wrong email", tokenHash: "token-hash", email: "wrong@gmail.com", expiresAt: future() },
    { name: "wrong email", tokenHash: "token-hash", email: "wrong@gmail.com", expiresAt: new Date(Date.now() - 60000) }
  ])('requests with @name', async ( { tokenHash, email, expiresAt } ) => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});
    
    await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: email, tokenHash: tokenHash, expiresAt: expiresAt });
    const inviteAttempt = await claimInvite(pool, {tokenHash: 'token-hash', email: 'Dad@gmail.com'});

    expect(inviteAttempt).toBeNull();
  });

  it('invite can still be claimed after a failed attempt', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});
    
    await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: 'DAD@gmail.com', tokenHash: 'token-hash', expiresAt: future() });
    await claimInvite(pool, {tokenHash: 'token-hash', email: 'wrong@gmail.com'});
    const secondClaimAttempt = await claimInvite(pool, {tokenHash: 'token-hash', email: 'Dad@gmail.com'});

    expect(secondClaimAttempt).not.toBeNull();
    expect(secondClaimAttempt?.familyId).toEqual(1)
  });

  it('cannot create two invites with the same token hash', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});
    
    await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: 'DAD@gmail.com', tokenHash: 'token-hash', expiresAt: future() });
    const invite2 = await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: 'DAD@gmail.com', tokenHash: 'token-hash', expiresAt: future() });
    
    expect(invite2).toBeNull();
  });

   it('deleting a family deletes its invites', async () => {
    const family = await createFamily(pool, {...familyDetails});
    const parent = await createParent(pool, {...parentDetails});
    
    const invite = await createInvite(pool, { familyId: family.id, invitedBy: parent.id, email: 'DAD@gmail.com', tokenHash: 'token-hash', expiresAt: future() });

    expect(invite).not.toBeNull();

    await pool.query(
      `DELETE FROM families
       WHERE id = $1`,
      [family.id]);

    expect(invite).toBeNull();
  });
});
