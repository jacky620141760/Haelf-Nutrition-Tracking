import { getDb, runInTransaction } from '../database';

export async function getSyncMeta(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_state WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)`,
    [key, value]
  );
}

export async function enqueueOutbox(input: {
  tableName: string;
  cloudId: string;
  localId: number | null;
  op: 'upsert' | 'delete';
  payloadJson?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await getDb().runAsync(
    `INSERT INTO sync_outbox (table_name, cloud_id, local_id, op, payload_json, updated_at, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      input.tableName,
      input.cloudId,
      input.localId,
      input.op,
      input.payloadJson ?? null,
      now,
      now,
    ]
  );
}

export type OutboxRow = {
  id: number;
  table_name: string;
  cloud_id: string;
  local_id: number | null;
  op: 'upsert' | 'delete';
  payload_json: string | null;
  updated_at: string;
  created_at: string;
};

export async function listOutbox(limit = 200): Promise<OutboxRow[]> {
  return getDb().getAllAsync<OutboxRow>(
    `SELECT * FROM sync_outbox ORDER BY id ASC LIMIT ?`,
    [limit]
  );
}

export async function deleteOutboxIds(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await runInTransaction(async (txn) => {
    for (const id of ids) {
      await txn.runAsync(`DELETE FROM sync_outbox WHERE id = ?`, [id]);
    }
  });
}

export function newCloudId(): string {
  // RFC4122-ish uuid v4 without extra dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
