import { ConfigService } from '@nestjs/config';

export function isDbSyncEnabled(
  configService: ConfigService,
  envKey: 'DB_SYNC' | 'TENANT_DB_SYNC' = 'DB_SYNC',
): boolean {
  return configService.get(envKey) === 'true';
}

/** Query logging is opt-in via DB_LOGGING=true (disabled by default). */
export function getTypeOrmLogging(
  configService: ConfigService,
): boolean | ('error' | 'warn')[] {
  if (configService.get('DB_LOGGING') === 'true') {
    return true;
  }
  return ['error', 'warn'];
}
