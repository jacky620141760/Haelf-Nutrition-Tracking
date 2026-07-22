export const SCHEMA_VERSION = 2;

export type Migration = {
  version: number;
  sql: string;
};

export const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS food_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  basis TEXT NOT NULL CHECK(basis IN ('PER_100_G','PER_SERVING')),
  source_kcal REAL NOT NULL,
  source_protein_g REAL NOT NULL,
  source_fat_g REAL NOT NULL,
  source_carbs_g REAL NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  barcode TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_favorite ON food_catalog(is_favorite);
CREATE INDEX IF NOT EXISTS idx_catalog_last_used ON food_catalog(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_barcode ON food_catalog(barcode);

CREATE TABLE IF NOT EXISTS food_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
  basis TEXT NOT NULL CHECK(basis IN ('PER_100_G','PER_SERVING')),
  source_kcal REAL NOT NULL,
  source_protein_g REAL NOT NULL,
  source_fat_g REAL NOT NULL,
  source_carbs_g REAL NOT NULL,
  quantity REAL NOT NULL,
  snap_kcal REAL NOT NULL,
  snap_protein_g REAL NOT NULL,
  snap_fat_g REAL NOT NULL,
  snap_carbs_g REAL NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('manual','cache','off','ai')),
  catalog_id INTEGER REFERENCES food_catalog(id) ON DELETE SET NULL,
  barcode TEXT,
  utc_timestamp TEXT NOT NULL,
  local_date TEXT NOT NULL,
  tz_iana TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_food_local_date ON food_entries(local_date);
CREATE INDEX IF NOT EXISTS idx_food_local_date_meal ON food_entries(local_date, meal_type);

CREATE TABLE IF NOT EXISTS daily_goal_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_date TEXT NOT NULL UNIQUE,
  kcal REAL NOT NULL,
  protein_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_effective ON daily_goal_versions(effective_date);

CREATE TABLE IF NOT EXISTS barcode_cache (
  barcode TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  basis TEXT NOT NULL CHECK(basis IN ('PER_100_G','PER_SERVING')),
  source_kcal REAL NOT NULL,
  source_protein_g REAL NOT NULL,
  source_fat_g REAL NOT NULL,
  source_carbs_g REAL NOT NULL,
  confirmed_at TEXT NOT NULL,
  last_hit_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_barcode_last_hit ON barcode_cache(last_hit_at);

CREATE TABLE IF NOT EXISTS weight_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kg REAL NOT NULL,
  utc_timestamp TEXT NOT NULL,
  local_date TEXT NOT NULL,
  tz_iana TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weight_local_date ON weight_entries(local_date);
CREATE INDEX IF NOT EXISTS idx_weight_local_utc ON weight_entries(local_date, utc_timestamp DESC, id DESC);

CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  endpoint_url TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  vision_supported INTEGER,
  consent_given INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

export const MIGRATION_V2 = `
ALTER TABLE food_entries ADD COLUMN log_group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_food_log_group ON food_entries(log_group_id);

CREATE TABLE IF NOT EXISTS water_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ml REAL NOT NULL CHECK(ml > 0),
  utc_timestamp TEXT NOT NULL,
  local_date TEXT NOT NULL,
  tz_iana TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_local_date ON water_entries(local_date);

CREATE TABLE IF NOT EXISTS water_goal_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_date TEXT NOT NULL UNIQUE,
  ml REAL NOT NULL CHECK(ml > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_goal_effective ON water_goal_versions(effective_date);

CREATE TABLE IF NOT EXISTS exercise_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration_minutes REAL NOT NULL CHECK(duration_minutes > 0),
  burned_kcal REAL NOT NULL CHECK(burned_kcal >= 0),
  source TEXT NOT NULL CHECK(source IN ('manual')),
  utc_timestamp TEXT NOT NULL,
  local_date TEXT NOT NULL,
  tz_iana TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercise_local_date ON exercise_entries(local_date);

CREATE TABLE IF NOT EXISTS daily_step_totals (
  local_date TEXT PRIMARY KEY NOT NULL,
  steps INTEGER NOT NULL CHECK(steps >= 0),
  source TEXT NOT NULL CHECK(source IN ('pedometer','manual')),
  synced_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  photo_uri TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_meal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_meal_id INTEGER NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  basis TEXT NOT NULL CHECK(basis IN ('PER_100_G','PER_SERVING')),
  source_kcal REAL NOT NULL,
  source_protein_g REAL NOT NULL,
  source_fat_g REAL NOT NULL,
  source_carbs_g REAL NOT NULL,
  default_quantity REAL NOT NULL CHECK(default_quantity > 0),
  catalog_id INTEGER REFERENCES food_catalog(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_meal_items_parent ON saved_meal_items(saved_meal_id, sort_order);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_servings REAL NOT NULL CHECK(total_servings > 0),
  photo_uri TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  basis TEXT NOT NULL CHECK(basis IN ('PER_100_G','PER_SERVING')),
  source_kcal REAL NOT NULL,
  source_protein_g REAL NOT NULL,
  source_fat_g REAL NOT NULL,
  source_carbs_g REAL NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  catalog_id INTEGER REFERENCES food_catalog(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_parent ON recipe_ingredients(recipe_id, sort_order);

CREATE TABLE IF NOT EXISTS daily_diary_status (
  local_date TEXT PRIMARY KEY NOT NULL,
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_preferences (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  locale TEXT NOT NULL DEFAULT 'zh-TW',
  water_unit TEXT NOT NULL DEFAULT 'ml' CHECK(water_unit IN ('ml','cup','oz')),
  week_start INTEGER NOT NULL DEFAULT 1 CHECK(week_start IN (0,1)),
  step_mode TEXT NOT NULL DEFAULT 'pedometer' CHECK(step_mode IN ('pedometer','manual')),
  exercise_calories_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO app_preferences
  (id, locale, water_unit, week_start, step_mode, exercise_calories_enabled, updated_at)
VALUES (1, 'zh-TW', 'ml', 1, 'pedometer', 1, datetime('now'));
`;

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: MIGRATION_V1 },
  { version: 2, sql: MIGRATION_V2 },
];

export function pendingMigrations(
  currentVersion: number,
  targetVersion = SCHEMA_VERSION
): Migration[] {
  if (!Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error(`無效的資料庫版本：${currentVersion}`);
  }
  if (currentVersion > targetVersion) {
    throw new Error(`資料庫版本 ${currentVersion} 高於 App 支援版本 ${targetVersion}`);
  }

  const byVersion = new Map(MIGRATIONS.map((migration) => [migration.version, migration]));
  const result: Migration[] = [];
  for (let version = currentVersion + 1; version <= targetVersion; version += 1) {
    const migration = byVersion.get(version);
    if (!migration) throw new Error(`缺少資料庫 migration v${version}`);
    result.push(migration);
  }
  return result;
}
