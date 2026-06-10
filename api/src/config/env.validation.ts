import * as Joi from 'joi';

/**
 * Fail-fast validation of the runtime environment. The app refuses to boot
 * with a missing/invalid critical variable rather than failing mysteriously later.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),
  DATABASE_URL: Joi.string().required(),
  // Optional comma-separated list of read-replica URLs. Empty → reads use primary.
  DATABASE_REPLICA_URLS: Joi.string().allow('').optional(),
  JWT_SECRET: Joi.string().min(8).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  INVOICE_DUE_IN_DAYS: Joi.number().default(30),
});
