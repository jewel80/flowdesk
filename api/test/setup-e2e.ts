/**
 * Defaults for the e2e run. The suite boots the real Nest app and talks to the
 * Postgres + Redis exposed by Docker Compose on localhost. Override any value via
 * the environment (e.g. point DATABASE_URL at a dedicated test database).
 *
 * Prerequisite: the database must be migrated and seeded (the demo users are used
 * to authenticate). `docker compose up` does both automatically.
 */
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://flowdesk:flowdesk@localhost:5432/flowdesk?schema=public';
process.env.JWT_SECRET ??= 'e2e-test-secret-change-me';
process.env.JWT_EXPIRES_IN ??= '1d';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
process.env.CORS_ORIGIN ??= '*';
process.env.INVOICE_DUE_IN_DAYS ??= '30';
// Reads use the primary in e2e (no replica needed).
delete process.env.DATABASE_REPLICA_URLS;
