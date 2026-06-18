import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from '../dataSource/data-source';

async function runMigrations() {
  try {
    console.log('Initializing database connection...');
    console.log('Database Config:');
    console.log(`  Host: ${process.env.DB_HOST }`);
    console.log(`  Port: ${process.env.DB_PORT }`);
    console.log(`  User: ${process.env.DB_USER }`);
    console.log(`  Database: ${process.env.DB_NAME }`);
    
    await AppDataSource.initialize();
    
    console.log('✅ Connected to database successfully!');
    console.log('Running migrations...');
    const migrations = await AppDataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('No pending migrations found.');
    } else {
      console.log(`Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach(migration => {
        console.log(`  - ${migration.name}`);
      });
    }
    
    await AppDataSource.destroy();
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();


