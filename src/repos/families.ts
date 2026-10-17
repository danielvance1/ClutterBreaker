import type { Db } from './db.js';

export type Family = {
  id: number;
  name: string;
  joinCode: string;
  createdAt: Date;
};

type FamilyRow = {
  id: number;
  name: string;
  join_code: string;
  created_at: Date;
};

function toFamily(row: FamilyRow): Family {
  return { id: row.id, name: row.name, joinCode: row.join_code, createdAt: row.created_at };
}

export async function createFamily(
  db: Db,
  input: { name: string; joinCode: string },
): Promise<Family> {
  const { rows } = await db.query<FamilyRow>(
    `INSERT INTO families (name, join_code)
     VALUES ($1, $2)
     RETURNING id, name, join_code, created_at`,
    [input.name, input.joinCode],
  );
  return toFamily(rows[0]);
}

export async function findFamilyByJoinCode(db: Db, joinCode: string): Promise<Family | null> {
  const { rows } = await db.query<FamilyRow>(
    `SELECT id, name, join_code, created_at
     FROM families
     WHERE join_code = $1`,
    [joinCode],
  );
  return rows[0] ? toFamily(rows[0]) : null;
}
