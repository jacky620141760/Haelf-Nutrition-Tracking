import initSqlJs from 'sql.js';
import { MIGRATION_V1, MIGRATION_V2, MIGRATION_V3, MIGRATION_V4 } from '../src/db/schema';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
const SQL = await initSqlJs();
const db = new SQL.Database();
db.run('PRAGMA foreign_keys = ON');

db.run('BEGIN');
try {
  db.exec(MIGRATION_V1);
  db.run(
    `INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1')`
  );
  db.run('COMMIT');
} catch (error) {
  db.run('ROLLBACK');
  throw error;
}

const now = '2026-07-20T00:00:00.000Z';
db.run(
  `INSERT INTO food_catalog
   (name,basis,source_kcal,source_protein_g,source_fat_g,source_carbs_g,is_favorite,last_used_at,barcode,created_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ['Oats', 'PER_100_G', 380, 13, 7, 68, 1, now, null, now, now]
);
const catalogId = db.exec(`SELECT last_insert_rowid() AS id`)[0].values[0][0] as number;
db.run(
  `INSERT INTO food_entries
   (name,meal_type,basis,source_kcal,source_protein_g,source_fat_g,source_carbs_g,quantity,
    snap_kcal,snap_protein_g,snap_fat_g,snap_carbs_g,source,catalog_id,barcode,utc_timestamp,
    local_date,tz_iana,tz_offset_minutes,created_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ['Oats', 'breakfast', 'PER_100_G', 380, 13, 7, 68, 50, 190, 6.5, 3.5, 34, 'manual', catalogId, null, now, '2026-07-20', 'Asia/Taipei', 480, now, now]
);

db.run('BEGIN');
try {
  db.exec(MIGRATION_V2);
  db.run(
    `INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '2')`
  );
  db.run('COMMIT');
} catch (error) {
  db.run('ROLLBACK');
  throw error;
}

assert(
  db.exec(`SELECT value FROM meta WHERE key='schema_version'`)[0].values[0][0] === '2',
  'migration reaches v2'
);
assert(
  db.exec(`SELECT COUNT(*) FROM food_entries`)[0].values[0][0] === 1,
  'migration preserves v1 food'
);
assert(
  db.exec(`PRAGMA table_info(food_entries)`)[0].values.some((row) => row[1] === 'log_group_id'),
  'food log_group_id exists'
);

db.run('BEGIN');
try {
  db.exec(MIGRATION_V3);
  db.run(
    `INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '3')`
  );
  db.run('COMMIT');
} catch (error) {
  db.run('ROLLBACK');
  throw error;
}

assert(
  db.exec(`SELECT value FROM meta WHERE key='schema_version'`)[0].values[0][0] === '3',
  'migration reaches v3'
);
assert(
  db.exec(`PRAGMA table_info(food_entries)`)[0].values.some((row) => row[1] === 'cloud_id'),
  'food cloud_id exists'
);

db.run('BEGIN');
try {
  db.exec(MIGRATION_V4);
  db.run(
    `INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '4')`
  );
  db.run('COMMIT');
} catch (error) {
  db.run('ROLLBACK');
  throw error;
}

assert(
  db.exec(`SELECT value FROM meta WHERE key='schema_version'`)[0].values[0][0] === '4',
  'migration reaches v4'
);
assert(
  db.exec(`PRAGMA table_info(app_preferences)`)[0].values.some((row) => row[1] === 'target_weight_kg'),
  'body plan columns exist'
);

db.run('BEGIN');
try {
  db.run(
    `INSERT INTO saved_meals(name,photo_uri,created_at,updated_at) VALUES (?,?,?,?)`,
    ['Breakfast', null, now, now]
  );
  const mealId = db.exec(`SELECT last_insert_rowid()`)[0].values[0][0];
  db.run(
    `INSERT INTO saved_meal_items
     (saved_meal_id,sort_order,name,basis,source_kcal,source_protein_g,source_fat_g,source_carbs_g,default_quantity,catalog_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [mealId, 0, 'Oats', 'PER_100_G', 380, 13, 7, 68, 50, catalogId]
  );
  db.run('COMMIT');
} catch (error) {
  db.run('ROLLBACK');
  throw error;
}
assert(
  db.exec(`SELECT COUNT(*) FROM saved_meal_items`)[0].values[0][0] === 1,
  'saved meal batch commits'
);

const mealsBeforeRollback = db.exec(`SELECT COUNT(*) FROM saved_meals`)[0].values[0][0];
db.run('BEGIN');
try {
  db.run(
    `INSERT INTO saved_meals(name,photo_uri,created_at,updated_at) VALUES (?,?,?,?)`,
    ['Broken', null, now, now]
  );
  db.run(
    `INSERT INTO saved_meal_items(saved_meal_id,sort_order,name,basis,source_kcal,source_protein_g,source_fat_g,source_carbs_g,default_quantity)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [999999, 0, 'Missing parent', 'PER_SERVING', 1, 1, 1, 1, 1]
  );
  db.run('COMMIT');
  throw new Error('foreign-key write unexpectedly succeeded');
} catch {
  db.run('ROLLBACK');
}
assert(
  db.exec(`SELECT COUNT(*) FROM saved_meals`)[0].values[0][0] === mealsBeforeRollback,
  'failed batch rolls back the whole meal'
);

db.run(
  `INSERT INTO food_entries (
    name,meal_type,basis,source_kcal,source_protein_g,source_fat_g,source_carbs_g,quantity,
    snap_kcal,snap_protein_g,snap_fat_g,snap_carbs_g,source,catalog_id,barcode,log_group_id,
    utc_timestamp,local_date,tz_iana,tz_offset_minutes,created_at,updated_at
  )
  SELECT name,'lunch',basis,source_kcal,source_protein_g,source_fat_g,source_carbs_g,quantity,
    snap_kcal,snap_protein_g,snap_fat_g,snap_carbs_g,source,catalog_id,barcode,'copy-test',
    ?, '2026-07-21',tz_iana,tz_offset_minutes,?,?
  FROM food_entries WHERE id=1`,
  [now, now, now]
);
const snapshots = db.exec(
  `SELECT snap_kcal,snap_protein_g,snap_fat_g,snap_carbs_g FROM food_entries ORDER BY id`
)[0].values;
assert(
  JSON.stringify(snapshots[0]) === JSON.stringify(snapshots[1]),
  'copy preserves nutrition snapshot exactly'
);

db.run(`DELETE FROM food_catalog WHERE id=?`, [catalogId]);
assert(
  db.exec(`SELECT COUNT(*) FROM food_entries`)[0].values[0][0] === 2,
  'catalog deletion preserves diary history'
);

db.close();
console.log('verify-repositories: all passed');
}

void main();
