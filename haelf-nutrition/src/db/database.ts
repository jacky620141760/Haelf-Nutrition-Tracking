import * as SQLite from 'expo-sqlite';
import type { DbInitResult } from '../domain/types';
import { MIGRATION_V1, SCHEMA_VERSION } from './schema';

const DB_NAME = 'haelf_nutrition.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let writeAllowed = true;

export function isWriteAllowed(): boolean {
  return writeAllowed;
}

export function setWriteAllowed(allowed: boolean): void {
  writeAllowed = allowed;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error('資料庫尚未初始化');
  }
  if (!writeAllowed) {
    // Allow reads even when write-locked; callers must check for writes
  }
  return dbInstance;
}

export function assertWritable(): void {
  if (!writeAllowed) {
    throw new Error('資料庫目前禁止寫入');
  }
}

async function getSchemaVersion(db: SQLite.SQLiteDatabase): Promise<number | null> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM meta WHERE key = 'schema_version'`
    );
    if (!row) return 0;
    return Number(row.value);
  } catch {
    // meta table may not exist
    return null;
  }
}

async function tableExists(db: SQLite.SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [name]
  );
  return !!row;
}

export async function initDatabase(): Promise<DbInitResult> {
  try {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    const db = dbInstance;

    const hasMeta = await tableExists(db, 'meta');
    let version = hasMeta ? await getSchemaVersion(db) : 0;
    if (version === null) {
      // Corrupt / unreadable
      writeAllowed = false;
      return { status: 'unsupported', error: '資料庫無法讀取' };
    }

    if (version > SCHEMA_VERSION) {
      writeAllowed = false;
      return {
        status: 'unsupported',
        error: `資料庫版本 ${version} 高於 App 支援版本 ${SCHEMA_VERSION}`,
      };
    }

    if (version < SCHEMA_VERSION) {
      try {
        await db.execAsync('BEGIN');
        if (version === 0) {
          await db.execAsync(MIGRATION_V1);
          await db.runAsync(
            `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`,
            [String(SCHEMA_VERSION)]
          );
          await db.runAsync(
            `INSERT OR IGNORE INTO ai_settings (id, endpoint_url, model, vision_supported, consent_given, updated_at)
             VALUES (1, '', '', NULL, 0, ?)`,
            [new Date().toISOString()]
          );
        }
        await db.execAsync('COMMIT');
        version = SCHEMA_VERSION;
      } catch (e) {
        try {
          await db.execAsync('ROLLBACK');
        } catch {
          /* ignore */
        }
        writeAllowed = false;
        return {
          status: 'migration_failed',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    writeAllowed = true;
    return { status: 'ready', schemaVersion: version ?? SCHEMA_VERSION };
  } catch (e) {
    writeAllowed = false;
    return {
      status: 'unsupported',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function clearAllAppTables(): Promise<void> {
  assertWritable();
  const db = getDb();
  await db.execAsync('BEGIN');
  try {
    await db.execAsync(`
      DELETE FROM food_entries;
      DELETE FROM food_catalog;
      DELETE FROM barcode_cache;
      DELETE FROM daily_goal_versions;
      DELETE FROM weight_entries;
      UPDATE ai_settings SET endpoint_url='', model='', vision_supported=NULL, consent_given=0, updated_at='${new Date().toISOString()}' WHERE id=1;
    `);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function deleteDatabaseAndReopen(): Promise<DbInitResult> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
  writeAllowed = true;
  return initDatabase();
}
