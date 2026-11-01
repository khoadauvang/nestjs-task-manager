import type { DataSourceOptions } from 'typeorm';
import type { DatabaseEnv } from '../config/env.schema.js';
import { entities } from './entities.js';
import { migrations } from './migrations/index.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

/** Shared by the Nest app (TypeOrmModule) and the TypeORM CLI (data-source.ts). */
export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    entities,
    migrations,
    namingStrategy: new SnakeNamingStrategy(),
    // The schema only changes through migrations, never automatically.
    synchronize: false,
    migrationsRun: env.DB_RUN_MIGRATIONS,
    dropSchema: env.DB_DROP_SCHEMA,
    logging: env.DB_LOGGING,
    // gen_random_uuid() is built into PostgreSQL 13+, no extension needed.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
  };
}
