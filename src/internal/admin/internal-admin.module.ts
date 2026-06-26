import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalAdminController } from './internal-admin.controller';
import { InternalAdminService } from './internal-admin.service';
import { User } from '../../entities/user.entity';
import { Admin } from '../../entities/admin.entity';
import { InternalServiceGuard } from '../../auth/internal-service.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Admin])],
  controllers: [InternalAdminController],
  providers: [InternalAdminService, InternalServiceGuard],
  exports: [InternalAdminService],
})
export class InternalAdminModule {}
