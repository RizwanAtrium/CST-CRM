import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/cst_crm'),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-me-now'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_TIMEZONE: z.string().default('America/New_York'),
  CRON_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  CRON_SECRET: z.string().min(16).default('development-cron-secret'),
  SALES_CRM_INTEGRATION_SECRET: z.string().min(24).default('development-sales-integration-key'),
  DIRECTOR_EMAIL: z.string().email().default('asad@example.com'),
  DIRECTOR_PASSWORD: z.string().min(8).default('ChangeMe123!')
});

export const env = schema.parse(process.env);
