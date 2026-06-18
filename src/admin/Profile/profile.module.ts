import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../../entities/admin.entity';
import { User } from '../../entities/user.entity';
import { AdminProfileService } from './profile.services';
import { AdminProfileController } from './profile.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Admin, User])],
    controllers: [AdminProfileController],
    providers: [AdminProfileService],
    exports: [AdminProfileService],
})
export class AdminProfileModule { }

