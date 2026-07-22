/**
 * Public migration registry entry point.
 * SQL stays in schema.ts so a fresh database and upgrades share one source of truth.
 */
export {
  MIGRATIONS,
  MIGRATION_V1,
  MIGRATION_V2,
  pendingMigrations,
  SCHEMA_VERSION,
  type Migration,
} from '../schema';
