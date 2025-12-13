/**
 * Environment variable validation and access
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  RAILWAY_ENVIRONMENT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function getEnv(): Env {
  if (!env) {
    env = envSchema.parse(process.env);
    
    // Production 환경에서는 JWT_SECRET 필수
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required in production environment');
    }
  }
  return env;
}

export function validateEnv() {
  try {
    getEnv();
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Env] Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('[Env] Environment validation failed:', error);
    }
    return false;
  }
}

