import 'reflect-metadata';
import '../config/load-env';
import { AppDataSource } from '../dataSource/data-source';
import { TENANT_BUSINESS_TABLES } from '../common/database/tenant-database.config';

async function cleanupPlatformDb() {
  try {
    console.log('Connecting to platform database...');
    await AppDataSource.initialize();

    for (const table of TENANT_BUSINESS_TABLES) {
      const quoted = table === 'order' ? '"order"' : table;
      await AppDataSource.query(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
      console.log(`Dropped tenant table (if existed): ${table}`);
    }

    console.log(
      'Platform DB cleanup complete. Only control-plane tables should remain.',
    );
  } catch (error) {
    console.error('Platform DB cleanup failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

cleanupPlatformDb();
