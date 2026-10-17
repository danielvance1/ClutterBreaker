import type { Pool } from 'pg';

// A pool or a transaction client, so repo functions work inside transactions.
export type Db = Pick<Pool, 'query'>;
