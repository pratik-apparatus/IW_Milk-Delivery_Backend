import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const DEV_ENV_FILE = '.env.dev';
const PROD_ENV_FILE = '.env';

export function resolveEnvFile(): string {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const appEnv = (process.env.APP_ENV || '').toLowerCase();

  if (nodeEnv === 'development' || appEnv === 'development') {
    return DEV_ENV_FILE;
  }

  return PROD_ENV_FILE;
}

/** Load dotenv before Nest bootstraps. Returns the file that was loaded. */
export function loadEnv(): string {
  const primary = resolveEnvFile();
  const primaryPath = resolve(process.cwd(), primary);

  if (existsSync(primaryPath)) {
    config({ path: primaryPath });
    return primary;
  }

  const fallback = primary === DEV_ENV_FILE ? PROD_ENV_FILE : DEV_ENV_FILE;
  const fallbackPath = resolve(process.cwd(), fallback);
  if (existsSync(fallbackPath)) {
    config({ path: fallbackPath });
    return fallback;
  }

  return primary;
}

/** Loaded at import time so env is available before other modules initialize. */
export const loadedEnvFile = loadEnv();

export function getConfigModuleOptions() {
  return {
    isGlobal: true,
    envFilePath: resolveEnvFile(),
  };
}
