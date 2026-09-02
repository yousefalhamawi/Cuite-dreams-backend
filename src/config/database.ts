import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from './env';

/**
 * Passwords often contain `@` (this project's does). If it is not encoded,
 * the URL parser treats it as the host separator and we connect to nowhere.
 */
function encodeDatabaseUrl(raw: string): string {
  const proto = raw.match(/^(postgres(?:ql)?):\/\//i);
  if (!proto) return raw;
  const rest = raw.slice(proto[0].length);
  const at = rest.lastIndexOf('@');
  if (at === -1) return raw;
  const userPass = rest.slice(0, at);
  let hostDb = rest.slice(at + 1);
  const colon = userPass.indexOf(':');
  if (colon === -1) return raw;
  const user = decodeURIComponent(userPass.slice(0, colon));
  const password = decodeURIComponent(userPass.slice(colon + 1));
  // pg 8.16+ treats sslmode=require as verify-full and that OVERRIDES
  // Pool({ ssl: { rejectUnauthorized: false } }). Supabase's pooler cert
  // is not in Node's trust store → SELF_SIGNED_CERT_IN_CHAIN.
  if (!hostDb.includes('localhost') && !hostDb.includes('127.0.0.1')) {
    hostDb = hostDb.replace(/([?&])sslmode=[^&]*/g, '$1sslmode=no-verify');
    if (!/[?&]sslmode=/.test(hostDb)) {
      hostDb += hostDb.includes('?') ? '&sslmode=no-verify' : '?sslmode=no-verify';
    }
  }
  return `${proto[1]}://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostDb}`;
}

const connectionString = encodeDatabaseUrl(env.DATABASE_URL);
const local =
  connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const pooler =
  connectionString.includes(':6543') || connectionString.includes('pooler.supabase');

export const pool = new Pool({
  connectionString,
  ssl: local ? undefined : { rejectUnauthorized: false },
  max: pooler ? 4 : 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

function isDeadConnection(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /terminat|timeout|ECONNRESET|ECONNREFUSED|not yet connected|connection/i.test(
    message,
  );
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    if (!isDeadConnection(err)) throw err;
    return pool.query<T>(text, params);
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
