export const SCHEMA_VERSION = 1;

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
