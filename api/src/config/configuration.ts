/**
 * Typed application configuration loaded from environment variables.
 * Centralised so no module reads `process.env` directly (no scattered magic strings).
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  database: {
    /** Primary (read-write) connection string. Receives all writes + transactions. */
    primaryUrl: string;
    /**
     * Zero or more read-replica connection strings (comma-separated in env).
     * Reads are round-robined across these; empty means reads use the primary.
     */
    replicaUrls: string[];
  };
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
  database: {
    primaryUrl: process.env.DATABASE_URL ?? '',
    replicaUrls: (process.env.DATABASE_REPLICA_URLS ?? '')
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
  },
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
