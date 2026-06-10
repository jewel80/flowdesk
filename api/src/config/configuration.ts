/**
 * Typed application configuration loaded from environment variables.
 * Centralised so no module reads `process.env` directly (no scattered magic strings).
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  redis: {
    host: string;
    port: number;
  };
  invoice: {
    /** Number of days from issue date until an invoice is due. */
    dueInDays: number;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  invoice: {
    dueInDays: parseInt(process.env.INVOICE_DUE_IN_DAYS ?? '30', 10),
  },
});
