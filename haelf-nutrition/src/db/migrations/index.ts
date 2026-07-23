/**
 * Public migration registry entry point.
 * SQL stays in schema.ts so a fresh database and upgrades share one source of truth.
 */
export {
  MIGRATIONS,
  MIGRATION_V1,
  MIGRATION_V2,
  MIGRATION_V3,
  MIGRATION_V4,
  ONGOING_GOAL_EFFECTIVE_DATE,
  pendingMigrations,
  SCHEMA_VERSION,
  type Migration,
} from '../schema';
