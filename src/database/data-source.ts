import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseEnvSchema } from '../config/env.schema.js';
import { buildDataSourceOptions } from './typeorm.config.js';

/**
 * Entry point for the TypeORM CLI (migration:generate / run / revert).
 * The CLI runs outside Nest, so it loads .env itself.
 */
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
const env = databaseEnvSchema.parse(process.env);

export default new DataSource({
  ...buildDataSourceOptions(env),
  migrationsRun: false,
  dropSchema: false,
});
