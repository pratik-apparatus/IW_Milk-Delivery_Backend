import 'reflect-metadata';
import '../config/load-env';
import { AppDataSource } from '../dataSource/data-source';

async function runPlatformMigrations() {
  try {
    console.log('=== Platform DB migrations ===');
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);

    await AppDataSource.initialize();
    console.log('Connected to platform database.');

    const migrations = await AppDataSource.runMigrations();
    if (migrations.length === 0) {
      console.log('No pending platform migrations.');
    } else {
      console.log(`Applied ${migrations.length} platform migration(s):`);
      migrations.forEach((migration) => console.log(`  - ${migration.name}`));
    }

    await AppDataSource.destroy();
    console.log('Platform migrations completed.');
    process.exit(0);
  } catch (error) {
    console.error('Platform migration failed:', error);
    process.exit(1);
  }
}

runPlatformMigrations();
