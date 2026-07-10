import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagedDatabase } from '../../entities/managed-database.entity';
import { TenantDbModule } from '../tenant-db/tenant-db.module';
import { ManagedDatabasesController } from './managed-databases.controller';
import { ManagedDatabasesService } from './managed-databases.service';

@Module({
  imports: [TypeOrmModule.forFeature([ManagedDatabase]), TenantDbModule],
  controllers: [ManagedDatabasesController],
  providers: [ManagedDatabasesService],
  exports: [ManagedDatabasesService],
})
export class ManagedDatabasesModule {}
