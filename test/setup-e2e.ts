import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Runs before every e2e file. Values set here win over .env.
 *
 * The tests use their own database, which is dropped and rebuilt from the
 * migrations each time the app starts (DB_DROP_SCHEMA). The env schema only
 * allows that when NODE_ENV=test and the database name ends with "_test".
 */
process.env.NODE_ENV = 'test';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USER ??= 'taskmanager';
process.env.DB_PASSWORD ??= 'taskmanager';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'taskmanager_test';
process.env.DB_DROP_SCHEMA = 'true';
process.env.DB_RUN_MIGRATIONS = 'true';
process.env.DB_LOGGING = 'false';
process.env.JWT_ACCESS_SECRET =
  'e2e-test-secret-that-is-at-least-32-characters';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests only
process.env.SWAGGER_ENABLED = 'false';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'task-manager-e2e-'));
