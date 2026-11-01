import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  const base = {
    DB_USER: 'taskmanager',
    DB_PASSWORD: 'secret',
    DB_NAME: 'taskmanager',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
  };

  it('applies defaults and converts types', () => {
    const env = validateEnv({
      ...base,
      PORT: '8080',
      DB_LOGGING: 'false',
      CORS_ORIGINS: 'http://a.test, http://b.test',
    });
    expect(env.PORT).toBe(8080);
    // "false" must become false; Boolean("false") would be true.
    expect(env.DB_LOGGING).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.NODE_ENV).toBe('development');
    expect(env.BCRYPT_ROUNDS).toBe(12);
  });

  it('lists every invalid variable', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(
      /DB_USER[\s\S]*JWT_ACCESS_SECRET: JWT_ACCESS_SECRET must be at least 32 characters/,
    );
  });

  it('only allows dropping the schema of a test database', () => {
    expect(() => validateEnv({ ...base, DB_DROP_SCHEMA: 'true' })).toThrow(
      /DB_DROP_SCHEMA/,
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'test',
        DB_NAME: 'taskmanager_test',
        DB_DROP_SCHEMA: 'true',
      }),
    ).not.toThrow();
  });
});
