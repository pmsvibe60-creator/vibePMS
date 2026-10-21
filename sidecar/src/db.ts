import pg from 'pg';
import { config } from './config.ts';

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

/** Sidecar-owned state. Business data lives in Twenty; this is only plumbing. */
export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS signing_requests (
      token        text PRIMARY KEY,
      lease_id     text NOT NULL,
      role         text NOT NULL CHECK (role IN ('tenant', 'landlord')),
      signer_name  text NOT NULL,
      signer_email text NOT NULL,
      document_id  text NOT NULL,
      status       text NOT NULL DEFAULT 'pending',
      signed_name  text,
      signature_png text,
      signed_at    timestamptz,
      ip           text,
      user_agent   text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      expires_at   timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS signing_requests_lease ON signing_requests (lease_id);

    CREATE TABLE IF NOT EXISTS webhook_events (
      source     text NOT NULL,
      event_key  text NOT NULL,
      payload    jsonb NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      error      text,
      PRIMARY KEY (source, event_key)
    );

    CREATE TABLE IF NOT EXISTS lease_documents (
      id         text PRIMARY KEY,
      lease_id   text NOT NULL,
      content    jsonb NOT NULL,
      file       text NOT NULL,
      sha256     text NOT NULL,
      signed_file text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS counters (
      name text PRIMARY KEY,
      value bigint NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_counters (
      year int PRIMARY KEY,
      last_no int NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rent_runs (
      lease_id text NOT NULL,
      period   text NOT NULL,
      invoice_record_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (lease_id, period)
    );
  `);
}

/**
 * Gapless invoice numbering (RENT-2026-0007): the number is reserved inside a transaction that
 * only commits if `fn` succeeds (e.g. CasaPay accepted the invoice), so failures leave no holes.
 * The counter row stays locked while `fn` runs, which serialises invoice creation — fine at this scale.
 */
export async function withInvoiceNo<T>(prefix: string, year: number, fn: (invoiceNo: string) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ last_no: number }>(
      `INSERT INTO invoice_counters (year, last_no) VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE SET last_no = invoice_counters.last_no + 1
       RETURNING last_no`,
      [year],
    );
    const result = await fn(`${prefix}-${year}-${String(rows[0].last_no).padStart(4, '0')}`);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Generic monotonic counter (e.g. lease reference bases start at 101). */
export async function nextCounter(name: string, start = 1): Promise<number> {
  const { rows } = await query<{ value: string }>(
    `INSERT INTO counters (name, value) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [name, start],
  );
  return Number(rows[0].value);
}
