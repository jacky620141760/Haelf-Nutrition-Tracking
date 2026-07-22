import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { DbInitResult } from '../domain/types';
import { pendingMigrations, SCHEMA_VERSION } from './migrations';

const DB_NAME = 'haelf_nutrition.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let writeAllowed = true;
let webTransactionQueue: Promise<void> = Promise.resolve();

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

async function executeTransaction<T>(
  db: SQLite.SQLiteDatabase,
  task: (txn: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  if (Platform.OS === 'web') {
    const run = webTransactionQueue.then(async () => {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await task(db);
      });
      return result;
    });
    webTransactionQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
  let result!: T;
  await db.withExclusiveTransactionAsync(async (txn) => {
    result = await task(txn);
  });
  return result;
}

export async function runInTransaction<T>(
  task: (txn: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  assertWritable();
  return executeTransaction(getDb(), task);
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
    await db.execAsync('PRAGMA foreign_keys = ON');

    const hasMeta = await tableExists(db, 'meta');
    let version = hasMeta ? await getSchemaVersion(db) : 0;
    if (version === null) {
      // Corrupt / unreadable
      writeAllowed = false;
      return { status: 'unsupported', error: '資料庫無法讀取' };
    }

    if (!Number.isInteger(version) || version < 0) {
      writeAllowed = false;
      return { status: 'unsupported', error: `無效的資料庫版本：${version}` };
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
        const migrations = pendingMigrations(version, SCHEMA_VERSION);
        await executeTransaction(db, async (txn) => {
          for (const migration of migrations) {
            await txn.execAsync(migration.sql);
            if (migration.version === 1) {
              await txn.runAsync(
                `INSERT OR IGNORE INTO ai_settings (id, endpoint_url, model, vision_supported, consent_given, updated_at)
                 VALUES (1, '', '', NULL, 0, ?)`,
                [new Date().toISOString()]
              );
            }
            await txn.runAsync(
              `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`,
              [String(migration.version)]
            );
          }
        });
        version = migrations.at(-1)?.version ?? version;
        if (version !== SCHEMA_VERSION) {
          throw new Error(`資料庫 migration 未到達目標版本 ${SCHEMA_VERSION}`);
        }
      } catch (e) {
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
  await runInTransaction(async (txn) => {
    await txn.execAsync(`
      DELETE FROM sync_outbox;
      DELETE FROM sync_state;
      DELETE FROM saved_meal_items;
      DELETE FROM recipe_ingredients;
      DELETE FROM food_entries;
      DELETE FROM water_entries;
      DELETE FROM exercise_entries;
      DELETE FROM daily_step_totals;
      DELETE FROM daily_diary_status;
      DELETE FROM saved_meals;
      DELETE FROM recipes;
      DELETE FROM food_catalog;
      DELETE FROM barcode_cache;
      DELETE FROM daily_goal_versions;
      DELETE FROM water_goal_versions;
      DELETE FROM weight_entries;
      DELETE FROM app_preferences;
      UPDATE ai_settings SET endpoint_url='', model='', vision_supported=NULL, consent_given=0, updated_at='${new Date().toISOString()}' WHERE id=1;
    `);
  });
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
