import { z } from 'zod';

const parseList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

/**
 * Database settings. Kept as a separate schema so the TypeORM CLI
 * (src/database/data-source.ts) can validate only what it needs.
 */
export const databaseEnvSchema = z.object({
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_LOGGING: z.stringbool().default(false),
  DB_RUN_MIGRATIONS: z.stringbool().default(false),
  DB_DROP_SCHEMA: z.stringbool().default(false),
});

export const envSchema = databaseEnvSchema
  .extend({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform(parseList),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    SWAGGER_ENABLED: z.stringbool().default(true),
  })
  .refine(
    (env) =>
      !env.DB_DROP_SCHEMA ||
      (env.NODE_ENV === 'test' && env.DB_NAME.endsWith('_test')),
    {
      message:
        'DB_DROP_SCHEMA wipes the database, so it is only allowed when NODE_ENV=test and DB_NAME ends with "_test"',
      path: ['DB_DROP_SCHEMA'],
    },
  );

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: the app refuses to start with an invalid environment. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return result.data;
}
