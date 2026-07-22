import { getDb } from '../../db/database';
import {
  deleteOutboxIds,
  getSyncMeta,
  listOutbox,
  newCloudId,
  setSyncMeta,
} from '../../db/repositories/sync';
import { isSupabaseConfigured, supabase } from '../auth/client';

type SqlValue = string | number | null;
type SyncableTable =
  | 'food_catalog'
  | 'food_entries'
  | 'daily_goal_versions'
  | 'weight_entries'
  | 'water_entries'
  | 'water_goal_versions'
  | 'exercise_entries'
  | 'daily_step_totals'
  | 'daily_diary_status'
  | 'app_preferences';

const TABLES: SyncableTable[] = [
  'food_catalog',
  'food_entries',
  'daily_goal_versions',
  'weight_entries',
  'water_entries',
  'water_goal_versions',
  'exercise_entries',
  'daily_step_totals',
  'daily_diary_status',
  'app_preferences',
];

function v(value: unknown): SqlValue {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value);
}

function p(...values: unknown[]): SqlValue[] {
  return values.map(v);
}

async function run(sql: string, params: SqlValue[] = []): Promise<void> {
  await getDb().runAsync(sql, params);
}

function toRemoteRow(table: SyncableTable, row: Record<string, unknown>, userId: string) {
  const cloudId = String(row.cloud_id);
  const base = {
    id: cloudId,
    user_id: userId,
    local_id: row.id ?? null,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  };

  const map: Record<SyncableTable, Record<string, unknown>> = {
    food_catalog: {
      ...base,
      name: row.name,
      basis: row.basis,
      source_kcal: row.source_kcal,
      source_protein_g: row.source_protein_g,
      source_fat_g: row.source_fat_g,
      source_carbs_g: row.source_carbs_g,
      is_favorite: Boolean(row.is_favorite),
      last_used_at: row.last_used_at,
      barcode: row.barcode,
      created_at: row.created_at,
    },
    food_entries: {
      ...base,
      name: row.name,
      meal_type: row.meal_type,
      basis: row.basis,
      source_kcal: row.source_kcal,
      source_protein_g: row.source_protein_g,
      source_fat_g: row.source_fat_g,
      source_carbs_g: row.source_carbs_g,
      quantity: row.quantity,
      snap_kcal: row.snap_kcal,
      snap_protein_g: row.snap_protein_g,
      snap_fat_g: row.snap_fat_g,
      snap_carbs_g: row.snap_carbs_g,
      source: row.source,
      barcode: row.barcode,
      log_group_id: row.log_group_id,
      utc_timestamp: row.utc_timestamp,
      local_date: row.local_date,
      tz_iana: row.tz_iana,
      tz_offset_minutes: row.tz_offset_minutes,
      created_at: row.created_at,
    },
    daily_goal_versions: {
      ...base,
      effective_date: row.effective_date,
      kcal: row.kcal,
      protein_g: row.protein_g,
      fat_g: row.fat_g,
      carbs_g: row.carbs_g,
      created_at: row.created_at,
    },
    weight_entries: {
      ...base,
      kg: row.kg,
      utc_timestamp: row.utc_timestamp,
      local_date: row.local_date,
      tz_iana: row.tz_iana,
      tz_offset_minutes: row.tz_offset_minutes,
      created_at: row.created_at,
    },
    water_entries: {
      ...base,
      ml: row.ml,
      utc_timestamp: row.utc_timestamp,
      local_date: row.local_date,
      tz_iana: row.tz_iana,
      tz_offset_minutes: row.tz_offset_minutes,
      created_at: row.created_at,
    },
    water_goal_versions: {
      ...base,
      effective_date: row.effective_date,
      ml: row.ml,
      created_at: row.created_at,
    },
    exercise_entries: {
      ...base,
      name: row.name,
      duration_minutes: row.duration_minutes,
      burned_kcal: row.burned_kcal,
      source: row.source,
      utc_timestamp: row.utc_timestamp,
      local_date: row.local_date,
      tz_iana: row.tz_iana,
      tz_offset_minutes: row.tz_offset_minutes,
      created_at: row.created_at,
    },
    daily_step_totals: {
      ...base,
      local_date: row.local_date,
      steps: row.steps,
      source: row.source,
      synced_at: row.synced_at,
    },
    daily_diary_status: {
      ...base,
      local_date: row.local_date,
      completed_at: row.completed_at,
    },
    app_preferences: {
      ...base,
      locale: row.locale,
      water_unit: row.water_unit,
      week_start: row.week_start,
      step_mode: row.step_mode,
      exercise_calories_enabled: Boolean(row.exercise_calories_enabled),
    },
  };
  return map[table];
}

async function ensureCloudIds(table: SyncableTable): Promise<void> {
  const db = getDb();
  if (table === 'daily_step_totals' || table === 'daily_diary_status') {
    const rows = await db.getAllAsync<{ local_date: string; cloud_id: string | null }>(
      `SELECT local_date, cloud_id FROM ${table}`
    );
    for (const row of rows) {
      if (!row.cloud_id) {
        await run(`UPDATE ${table} SET cloud_id = ? WHERE local_date = ?`, p(newCloudId(), row.local_date));
      }
    }
    return;
  }
  if (table === 'app_preferences') {
    const row = await db.getFirstAsync<{ cloud_id: string | null }>(
      `SELECT cloud_id FROM app_preferences WHERE id = 1`
    );
    if (row && !row.cloud_id) {
      await run(`UPDATE app_preferences SET cloud_id = ? WHERE id = 1`, p(newCloudId()));
    }
    return;
  }
  const rows = await db.getAllAsync<{ id: number; cloud_id: string | null }>(
    `SELECT id, cloud_id FROM ${table}`
  );
  for (const row of rows) {
    if (!row.cloud_id) {
      await run(`UPDATE ${table} SET cloud_id = ? WHERE id = ?`, p(newCloudId(), row.id));
    }
  }
}

async function pushTable(table: SyncableTable, userId: string): Promise<void> {
  await ensureCloudIds(table);
  const rows = await getDb().getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  if (!rows.length) return;
  const payload = rows.map((row) => toRemoteRow(table, row, userId));
  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(`${table} push failed: ${error.message}`);
}

async function upsertByCloudId(
  table: SyncableTable,
  cloudId: string,
  updatedAt: string,
  deletedAt: string | null,
  insertSql: string,
  insertParams: SqlValue[],
  updateSql: string,
  updateParams: SqlValue[]
): Promise<void> {
  const existing = await getDb().getFirstAsync<{ id: number; updated_at: string }>(
    `SELECT id, updated_at FROM ${table} WHERE cloud_id = ?`,
    [cloudId]
  );
  if (existing && existing.updated_at >= updatedAt) return;
  if (deletedAt) {
    if (existing) {
      await run(`UPDATE ${table} SET deleted_at=?, updated_at=? WHERE id=?`, p(deletedAt, updatedAt, existing.id));
    }
    return;
  }
  if (existing) {
    await run(updateSql, [...updateParams, existing.id]);
  } else {
    await run(insertSql, insertParams);
  }
}

async function applyRemoteRow(table: SyncableTable, remote: Record<string, unknown>): Promise<void> {
  const cloudId = String(remote.id);
  const deletedAt = remote.deleted_at == null ? null : String(remote.deleted_at);
  const updatedAt = String(remote.updated_at ?? new Date().toISOString());
  const createdAt = String(remote.created_at ?? updatedAt);

  if (table === 'daily_goal_versions') {
    const existing = await getDb().getFirstAsync<{ id: number; updated_at: string }>(
      `SELECT id, updated_at FROM daily_goal_versions WHERE cloud_id = ? OR effective_date = ?`,
      p(cloudId, remote.effective_date)
    );
    if (existing && existing.updated_at >= updatedAt) return;
    if (deletedAt) {
      if (existing) {
        await run(
          `UPDATE daily_goal_versions SET deleted_at=?, updated_at=?, cloud_id=? WHERE id=?`,
          p(deletedAt, updatedAt, cloudId, existing.id)
        );
      }
      return;
    }
    if (existing) {
      await run(
        `UPDATE daily_goal_versions SET kcal=?, protein_g=?, fat_g=?, carbs_g=?, updated_at=?, cloud_id=?, deleted_at=NULL, effective_date=? WHERE id=?`,
        p(remote.kcal, remote.protein_g, remote.fat_g, remote.carbs_g, updatedAt, cloudId, remote.effective_date, existing.id)
      );
    } else {
      await run(
        `INSERT INTO daily_goal_versions (effective_date, kcal, protein_g, fat_g, carbs_g, created_at, updated_at, cloud_id, deleted_at)
         VALUES (?,?,?,?,?,?,?,?,NULL)`,
        p(remote.effective_date, remote.kcal, remote.protein_g, remote.fat_g, remote.carbs_g, createdAt, updatedAt, cloudId)
      );
    }
    return;
  }

  if (table === 'food_entries') {
    await upsertByCloudId(
      table,
      cloudId,
      updatedAt,
      deletedAt,
      `INSERT INTO food_entries (
        name, meal_type, basis, source_kcal, source_protein_g, source_fat_g, source_carbs_g, quantity,
        snap_kcal, snap_protein_g, snap_fat_g, snap_carbs_g, source, catalog_id, barcode, log_group_id,
        utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at, cloud_id, deleted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,NULL)`,
      p(
        remote.name, remote.meal_type, remote.basis, remote.source_kcal, remote.source_protein_g,
        remote.source_fat_g, remote.source_carbs_g, remote.quantity, remote.snap_kcal, remote.snap_protein_g,
        remote.snap_fat_g, remote.snap_carbs_g, remote.source, remote.barcode, remote.log_group_id,
        remote.utc_timestamp, remote.local_date, remote.tz_iana, remote.tz_offset_minutes, createdAt, updatedAt, cloudId
      ),
      `UPDATE food_entries SET name=?, meal_type=?, basis=?, source_kcal=?, source_protein_g=?, source_fat_g=?, source_carbs_g=?,
       quantity=?, snap_kcal=?, snap_protein_g=?, snap_fat_g=?, snap_carbs_g=?, source=?, barcode=?, log_group_id=?,
       utc_timestamp=?, local_date=?, tz_iana=?, tz_offset_minutes=?, updated_at=?, deleted_at=NULL WHERE id=?`,
      p(
        remote.name, remote.meal_type, remote.basis, remote.source_kcal, remote.source_protein_g,
        remote.source_fat_g, remote.source_carbs_g, remote.quantity, remote.snap_kcal, remote.snap_protein_g,
        remote.snap_fat_g, remote.snap_carbs_g, remote.source, remote.barcode, remote.log_group_id,
        remote.utc_timestamp, remote.local_date, remote.tz_iana, remote.tz_offset_minutes, updatedAt
      )
    );
    return;
  }

  if (table === 'food_catalog') {
    await upsertByCloudId(
      table,
      cloudId,
      updatedAt,
      deletedAt,
      `INSERT INTO food_catalog (name, basis, source_kcal, source_protein_g, source_fat_g, source_carbs_g, is_favorite, last_used_at, barcode, created_at, updated_at, cloud_id, deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      p(
        remote.name, remote.basis, remote.source_kcal, remote.source_protein_g, remote.source_fat_g,
        remote.source_carbs_g, remote.is_favorite ? 1 : 0, remote.last_used_at, remote.barcode, createdAt, updatedAt, cloudId
      ),
      `UPDATE food_catalog SET name=?, basis=?, source_kcal=?, source_protein_g=?, source_fat_g=?, source_carbs_g=?,
       is_favorite=?, last_used_at=?, barcode=?, updated_at=?, deleted_at=NULL WHERE id=?`,
      p(
        remote.name, remote.basis, remote.source_kcal, remote.source_protein_g, remote.source_fat_g,
        remote.source_carbs_g, remote.is_favorite ? 1 : 0, remote.last_used_at, remote.barcode, updatedAt
      )
    );
    return;
  }

  if (table === 'weight_entries' || table === 'water_entries' || table === 'exercise_entries') {
    if (table === 'weight_entries') {
      await upsertByCloudId(
        table, cloudId, updatedAt, deletedAt,
        `INSERT INTO weight_entries (kg, utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at, cloud_id, deleted_at)
         VALUES (?,?,?,?,?,?,?,?,NULL)`,
        p(remote.kg, remote.utc_timestamp, remote.local_date, remote.tz_iana, remote.tz_offset_minutes, createdAt, updatedAt, cloudId),
        `UPDATE weight_entries SET kg=?, utc_timestamp=?, local_date=?, tz_iana=?, tz_offset_minutes=?, updated_at=?, deleted_at=NULL WHERE id=?`,
        p(remote.kg, remote.utc_timestamp, remote.local_date, remote.tz_iana, remote.tz_offset_minutes, updatedAt)
      );
    } else if (table === 'water_entries') {
      await upsertByCloudId(
        table, cloudId, updatedAt, deletedAt,
        `INSERT INTO water_entries (ml, utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at, cloud_id, deleted_at)
         VALUES (?,?,?,?,?,?,?,?,NULL)`,
        p(remote.ml, remote.utc_timestamp, remote.local_date, remote.tz_iana, remote.tz_offset_minutes, createdAt, updatedAt, cloudId),
        `UPDATE water_entries SET ml=?, utc_timestamp=?, local_date=?, tz_iana=?, tz_offset_minutes=?, updated_at=?, deleted_at=NULL WHERE id=?`,
        p(remote.ml, remote.utc_timestamp, remote.local_date, remote.tz_iana, remote.tz_offset_minutes, updatedAt)
      );
    } else {
      await upsertByCloudId(
        table, cloudId, updatedAt, deletedAt,
        `INSERT INTO exercise_entries (name, duration_minutes, burned_kcal, source, utc_timestamp, local_date, tz_iana, tz_offset_minutes, created_at, updated_at, cloud_id, deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)`,
        p(
          remote.name, remote.duration_minutes, remote.burned_kcal, remote.source, remote.utc_timestamp,
          remote.local_date, remote.tz_iana, remote.tz_offset_minutes, createdAt, updatedAt, cloudId
        ),
        `UPDATE exercise_entries SET name=?, duration_minutes=?, burned_kcal=?, source=?, utc_timestamp=?, local_date=?, tz_iana=?, tz_offset_minutes=?, updated_at=?, deleted_at=NULL WHERE id=?`,
        p(
          remote.name, remote.duration_minutes, remote.burned_kcal, remote.source, remote.utc_timestamp,
          remote.local_date, remote.tz_iana, remote.tz_offset_minutes, updatedAt
        )
      );
    }
    return;
  }

  if (table === 'water_goal_versions') {
    const existing = await getDb().getFirstAsync<{ id: number; updated_at: string }>(
      `SELECT id, updated_at FROM water_goal_versions WHERE cloud_id = ? OR effective_date = ?`,
      p(cloudId, remote.effective_date)
    );
    if (existing && existing.updated_at >= updatedAt) return;
    if (deletedAt) {
      if (existing) {
        await run(
          `UPDATE water_goal_versions SET deleted_at=?, updated_at=?, cloud_id=? WHERE id=?`,
          p(deletedAt, updatedAt, cloudId, existing.id)
        );
      }
      return;
    }
    if (existing) {
      await run(
        `UPDATE water_goal_versions SET ml=?, updated_at=?, cloud_id=?, deleted_at=NULL, effective_date=? WHERE id=?`,
        p(remote.ml, updatedAt, cloudId, remote.effective_date, existing.id)
      );
    } else {
      await run(
        `INSERT INTO water_goal_versions (effective_date, ml, created_at, updated_at, cloud_id, deleted_at)
         VALUES (?,?,?,?,?,NULL)`,
        p(remote.effective_date, remote.ml, createdAt, updatedAt, cloudId)
      );
    }
    return;
  }

  if (table === 'daily_step_totals') {
    await run(
      `INSERT INTO daily_step_totals (local_date, steps, source, synced_at, updated_at, cloud_id, deleted_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(local_date) DO UPDATE SET
         steps=excluded.steps, source=excluded.source, synced_at=excluded.synced_at,
         updated_at=excluded.updated_at, cloud_id=excluded.cloud_id, deleted_at=excluded.deleted_at
       WHERE excluded.updated_at >= daily_step_totals.updated_at`,
      p(remote.local_date, remote.steps, remote.source, remote.synced_at, updatedAt, cloudId, deletedAt)
    );
    return;
  }

  if (table === 'daily_diary_status') {
    await run(
      `INSERT INTO daily_diary_status (local_date, completed_at, updated_at, cloud_id, deleted_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(local_date) DO UPDATE SET
         completed_at=excluded.completed_at, updated_at=excluded.updated_at,
         cloud_id=excluded.cloud_id, deleted_at=excluded.deleted_at
       WHERE excluded.updated_at >= daily_diary_status.updated_at`,
      p(remote.local_date, remote.completed_at, updatedAt, cloudId, deletedAt)
    );
    return;
  }

  if (table === 'app_preferences') {
    await run(
      `UPDATE app_preferences SET locale=?, water_unit=?, week_start=?, step_mode=?, exercise_calories_enabled=?, updated_at=?, cloud_id=? WHERE id=1`,
      p(
        remote.locale, remote.water_unit, remote.week_start, remote.step_mode,
        remote.exercise_calories_enabled ? 1 : 0, updatedAt, cloudId
      )
    );
  }
}

async function pullTable(table: SyncableTable, userId: string, since: string | null): Promise<void> {
  let query = supabase.from(table).select('*').eq('user_id', userId);
  if (since) query = query.gt('updated_at', since);
  const { data, error } = await query;
  if (error) throw new Error(`${table} pull failed: ${error.message}`);
  for (const remote of data ?? []) {
    await applyRemoteRow(table, remote as Record<string, unknown>);
  }
}

async function drainOutbox(): Promise<void> {
  const rows = await listOutbox();
  if (!rows.length) return;
  const done: number[] = [];
  for (const row of rows) {
    if (row.op === 'delete') {
      const { error } = await supabase
        .from(row.table_name)
        .update({ deleted_at: row.updated_at, updated_at: row.updated_at })
        .eq('id', row.cloud_id);
      if (error) throw new Error(error.message);
    } else if (row.payload_json) {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      const { error } = await supabase.from(row.table_name).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }
    done.push(row.id);
  }
  await deleteOutboxIds(done);
}

export type SyncResult = { ok: true } | { ok: false; message: string };

export async function runFullSync(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase is not configured' };
  }
  try {
    const since = await getSyncMeta('last_pull_at');
    for (const table of TABLES) await pushTable(table, userId);
    await drainOutbox();
    for (const table of TABLES) await pullTable(table, userId, since);
    await setSyncMeta('last_pull_at', new Date().toISOString());
    await setSyncMeta('bound_user_id', userId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function getBoundUserId(): Promise<string | null> {
  return getSyncMeta('bound_user_id');
}

export async function clearBoundUser(): Promise<void> {
  await setSyncMeta('bound_user_id', '');
  await setSyncMeta('last_pull_at', '');
}
