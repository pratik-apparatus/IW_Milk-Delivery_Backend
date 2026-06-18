import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { PLATFORM_ENTITIES } from '../common/database/platform-database.config';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: PLATFORM_ENTITIES,
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['query', 'error'],
  logger: 'advanced-console',
});
